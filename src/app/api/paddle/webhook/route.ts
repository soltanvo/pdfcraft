import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

const STARTER_PRICE_ID = 'pri_01m858qhsdhzkjbs0tvebhzbjd';
const PRO_PRICE_ID = 'pri_01m85912qp3z4d2bjfgp7v530v';
const SIGNATURE_TOLERANCE_SECONDS = 300;
const VALID_DOC_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

interface PaddleCustomData {
  userId?: unknown;
  user_id?: unknown;
  plan?: unknown;
}

interface PaddleWebhookItem {
  price?: {
    id?: string;
    unit_price?: {
      amount?: string | number;
      currency_code?: string;
    };
  };
  price_id?: string;
  totals?: {
    total?: string | number;
    subtotal?: string | number;
  };
}

interface PaddleWebhookData {
  id?: string;
  status?: string;
  customer_id?: string;
  subscription_id?: string;
  customer?: {
    id?: string;
    email?: string;
  };
  customer_email?: string;
  billing_details?: {
    email?: string;
  };
  custom_data?: PaddleCustomData;
  customData?: PaddleCustomData;
  items?: PaddleWebhookItem[];
  details?: {
    totals?: {
      total?: string | number;
      grand_total?: string | number;
      subtotal?: string | number;
      currency_code?: string;
    };
  };
  payments?: Array<{
    amount?: string | number;
    status?: string;
  }>;
}

interface PaddleWebhookPayload {
  event_id?: string;
  event_type?: string;
  data?: PaddleWebhookData;
}

function sanitizeEnvSecret(value: string | undefined): string {
  if (!value) return '';
  let trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function sanitizeDocId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return VALID_DOC_ID_RE.test(trimmed) ? trimmed : '';
}

function verifyPaddleSignature(rawBody: string, headerValue: string | null, secret: string): boolean {
  if (!headerValue || !secret) return false;

  const parts = headerValue.split(';').map((part) => part.trim());
  let timestamp = '';
  const signatures: string[] = [];

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key === 'ts') {
      timestamp = val;
    } else if (key === 'h1' && val) {
      signatures.push(val);
    }
  }

  if (!timestamp || signatures.length === 0) return false;

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsNum) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${timestamp}:${rawBody}`;
  const expectedHex = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  return signatures.some((sigHex) => {
    if (!/^[0-9a-f]+$/i.test(sigHex)) return false;
    const sigBuf = Buffer.from(sigHex, 'hex');
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  });
}

function parseAmountUsd(rawAmount: unknown): number | null {
  if (typeof rawAmount === 'number' && Number.isFinite(rawAmount) && rawAmount > 0) {
    return rawAmount >= 100 ? rawAmount / 100 : rawAmount;
  }
  if (typeof rawAmount !== 'string') return null;

  const trimmed = rawAmount.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  if (trimmed.includes('.')) {
    return numeric;
  }
  // Paddle Billing v2 transmits monetary amounts in minor currency units (e.g. "200" = $2.00, "500" = $5.00)
  return numeric >= 100 ? numeric / 100 : numeric;
}

interface ResolvedPlanInfo {
  plan: 'starter' | 'pro';
  credits: number;
  amountUsd: number;
}

function resolvePlanFromData(data: PaddleWebhookData): ResolvedPlanInfo | null {
  const items = Array.isArray(data.items) ? data.items : [];
  for (const item of items) {
    const priceId = (item?.price?.id || item?.price_id || '').trim();
    if (priceId === PRO_PRICE_ID) {
      return { plan: 'pro', credits: 100, amountUsd: 5 };
    }
    if (priceId === STARTER_PRICE_ID) {
      return { plan: 'starter', credits: 30, amountUsd: 2 };
    }
  }

  const amountCandidates: unknown[] = [
    data.details?.totals?.total,
    data.details?.totals?.grand_total,
    data.details?.totals?.subtotal,
    ...(Array.isArray(data.payments) ? data.payments.map((p) => p?.amount) : []),
    ...items.map((item) => item?.totals?.total ?? item?.price?.unit_price?.amount),
  ];

  for (const candidate of amountCandidates) {
    const amountUsd = parseAmountUsd(candidate);
    if (amountUsd === null) continue;
    if (amountUsd >= 4.5) {
      return { plan: 'pro', credits: 100, amountUsd: 5 };
    }
    if (amountUsd >= 1.5 && amountUsd < 4.5) {
      return { plan: 'starter', credits: 30, amountUsd: 2 };
    }
  }

  const customPlan = data.custom_data?.plan ?? data.customData?.plan;
  if (customPlan === 'pro') {
    return { plan: 'pro', credits: 100, amountUsd: 5 };
  }
  if (customPlan === 'starter') {
    return { plan: 'starter', credits: 30, amountUsd: 2 };
  }

  return null;
}

function extractCustomerEmail(data: PaddleWebhookData): string {
  const candidate =
    data.customer?.email || data.customer_email || data.billing_details?.email || '';
  return typeof candidate === 'string' ? candidate.trim() : '';
}

async function resolveUserId(
  adminDb: Firestore,
  data: PaddleWebhookData
): Promise<{ userId: string; email: string }> {
  const email = extractCustomerEmail(data);

  const customUserId =
    sanitizeDocId(data.custom_data?.userId) ||
    sanitizeDocId(data.custom_data?.user_id) ||
    sanitizeDocId(data.customData?.userId) ||
    sanitizeDocId(data.customData?.user_id);

  if (customUserId) {
    return { userId: customUserId, email };
  }

  if (email) {
    const exactSnap = await adminDb
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (!exactSnap.empty) {
      return { userId: exactSnap.docs[0].id, email };
    }

    const lowerEmail = email.toLowerCase();
    if (lowerEmail !== email) {
      const lowerSnap = await adminDb
        .collection('users')
        .where('email', '==', lowerEmail)
        .limit(1)
        .get();
      if (!lowerSnap.empty) {
        return { userId: lowerSnap.docs[0].id, email: lowerEmail };
      }
    }
  }

  const paddleCustomerId =
    typeof data.customer_id === 'string'
      ? data.customer_id.trim()
      : typeof data.customer?.id === 'string'
      ? data.customer.id.trim()
      : '';

  if (paddleCustomerId) {
    const customerSnap = await adminDb
      .collection('users')
      .where('paddleCustomerId', '==', paddleCustomerId)
      .limit(1)
      .get();
    if (!customerSnap.empty) {
      return { userId: customerSnap.docs[0].id, email };
    }
  }

  return { userId: '', email };
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = sanitizeEnvSecret(process.env.PADDLE_WEBHOOK_SECRET);
    if (!webhookSecret) {
      console.error('PADDLE_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const rawBody = await req.text();
    const signatureHeader = req.headers.get('paddle-signature');

    if (!verifyPaddleSignature(rawBody, signatureHeader, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: PaddleWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as PaddleWebhookPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventType = payload.event_type;
    const data = payload.data;
    if (!eventType || !data) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const adminDb = getAdminFirestore();
    const { userId, email: customerEmail } = await resolveUserId(adminDb, data);
    if (!userId || !VALID_DOC_ID_RE.test(userId)) {
      console.warn(`Paddle webhook ${eventType}: unable to resolve userId`, {
        transactionId: data.id || null,
        hasEmail: Boolean(customerEmail),
      });
      return NextResponse.json({ received: true, skipped: 'user_not_found' }, { status: 200 });
    }

    const userRef = adminDb.collection('users').doc(userId);
    const resolvedPlan = resolvePlanFromData(data);

    if (eventType === 'transaction.completed') {
      if (!resolvedPlan) {
        console.warn('Paddle transaction.completed: unable to determine plan or credit pack', {
          transactionId: data.id || null,
        });
        return NextResponse.json({ received: true, skipped: 'unknown_plan' }, { status: 200 });
      }

      const rawTxId =
        typeof data.id === 'string' && data.id.trim()
          ? data.id.trim()
          : typeof payload.event_id === 'string'
          ? payload.event_id.trim()
          : '';
      const txId = rawTxId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);

      if (!txId) {
        console.warn('Paddle transaction.completed missing transaction_id; skipping credit grant');
        return NextResponse.json({ received: true, skipped: 'missing_transaction_id' }, { status: 200 });
      }

      const processedTxRef = adminDb.collection('processed_transactions').doc(txId);
      const userTxRef = userRef.collection('transactions').doc(txId);

      const grantResult = await adminDb.runTransaction(async (tx) => {
        // Firestore transactions require all reads before any writes
        const [processedTxSnap, userSnap] = await Promise.all([
          tx.get(processedTxRef),
          tx.get(userRef),
        ]);

        const existingData = userSnap.exists ? userSnap.data() || {} : {};
        if (processedTxSnap.exists || existingData.lastOrderId === txId) {
          return { duplicate: true };
        }

        const userUpdate: Record<string, unknown> = {
          uid: userId,
          credits: FieldValue.increment(resolvedPlan.credits),
          plan: resolvedPlan.plan,
          subscriptionStatus: 'active',
          isPaid: true,
          paddleCustomerId:
            data.customer_id || data.customer?.id || existingData.paddleCustomerId || '',
          paddleSubscriptionId:
            data.subscription_id || existingData.paddleSubscriptionId || '',
          lastOrderId: txId,
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (!userSnap.exists) {
          userUpdate.email = customerEmail.slice(0, 320);
          userUpdate.displayName = 'SA AI User';
          userUpdate.photoURL = '';
          userUpdate.createdAt = FieldValue.serverTimestamp();
        } else if (!existingData.email && customerEmail) {
          userUpdate.email = customerEmail.slice(0, 320);
        }

        tx.set(userRef, userUpdate, { merge: true });

        tx.set(processedTxRef, {
          transaction_id: txId,
          eventId: typeof payload.event_id === 'string' ? payload.event_id : '',
          eventType,
          userId,
          planId: resolvedPlan.plan,
          creditsAdded: resolvedPlan.credits,
          amountUsd: resolvedPlan.amountUsd,
          customerEmail: customerEmail.slice(0, 320),
          processedAt: FieldValue.serverTimestamp(),
        });

        tx.set(
          userTxRef,
          {
            userId,
            orderId: txId,
            planId: resolvedPlan.plan,
            creditsAdded: resolvedPlan.credits,
            amountUsd: resolvedPlan.amountUsd,
            status: 'COMPLETED',
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return { duplicate: false };
      });

      return NextResponse.json(
        { received: true, duplicate: grantResult.duplicate },
        { status: 200 }
      );
    }

    if (
      eventType === 'subscription.activated' ||
      (eventType === 'subscription.updated' && data.status === 'active')
    ) {
      if (resolvedPlan) {
        await userRef.set(
          {
            uid: userId,
            plan: resolvedPlan.plan,
            subscriptionStatus: 'active',
            isPaid: true,
            paddleCustomerId: data.customer_id || data.customer?.id || '',
            paddleSubscriptionId: data.subscription_id || data.id || '',
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (eventType === 'subscription.canceled') {
      await userRef.set(
        {
          plan: 'free',
          subscriptionStatus: 'canceled',
          isPaid: false,
          paddleCustomerId: data.customer_id || data.customer?.id || '',
          paddleSubscriptionId: data.subscription_id || data.id || '',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('Paddle webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

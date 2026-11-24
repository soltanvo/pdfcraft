import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

const STARTER_PRICE_ID = 'pri_01m858qhsdhzkjbs0tvebhzbjd';
const PRO_PRICE_ID = 'pri_01m85912qp3z4d2bjfgp7v530v';
const SIGNATURE_TOLERANCE_SECONDS = 300;

interface PaddleWebhookItem {
  price?: {
    id?: string;
  };
  price_id?: string;
}

interface PaddleWebhookPayload {
  event_type?: string;
  data?: {
    id?: string;
    status?: string;
    customer_id?: string;
    subscription_id?: string;
    custom_data?: {
      userId?: string;
      plan?: string;
    };
    items?: PaddleWebhookItem[];
  };
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

function resolvePlanFromData(data: NonNullable<PaddleWebhookPayload['data']>): 'starter' | 'pro' | null {
  const firstItem = Array.isArray(data.items) ? data.items[0] : undefined;
  const priceId = firstItem?.price?.id || firstItem?.price_id || '';

  if (priceId === STARTER_PRICE_ID) return 'starter';
  if (priceId === PRO_PRICE_ID) return 'pro';

  const customPlan = data.custom_data?.plan;
  if (customPlan === 'starter' || customPlan === 'pro') return customPlan;

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
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

    const userId = typeof data.custom_data?.userId === 'string' ? data.custom_data.userId.trim() : '';
    if (!userId || !/^[a-zA-Z0-9_-]{1,128}$/.test(userId)) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const adminDb = getAdminFirestore();
    const userRef = adminDb.collection('users').doc(userId);
    const resolvedPlan = resolvePlanFromData(data);

    const isActivationEvent =
      eventType === 'transaction.completed' ||
      eventType === 'subscription.activated' ||
      (eventType === 'subscription.updated' && data.status === 'active');

    if (isActivationEvent && resolvedPlan) {
      const creditsForPlan = resolvedPlan === 'pro' ? 100 : 30;
      const amountUsd = resolvedPlan === 'pro' ? 5 : 2;
      const txId =
        typeof data.id === 'string' && data.id.trim()
          ? data.id.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128)
          : '';

      await adminDb.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const existingData = userSnap.exists ? userSnap.data() || {} : {};
        const alreadyAppliedTx =
          eventType === 'transaction.completed' &&
          txId &&
          existingData.lastOrderId === txId;

        const updatePayload: Record<string, unknown> = {
          uid: userId,
          plan: resolvedPlan,
          subscriptionStatus: 'active',
          isPaid: true,
          paddleCustomerId: data.customer_id || existingData.paddleCustomerId || '',
          paddleSubscriptionId:
            data.subscription_id || data.id || existingData.paddleSubscriptionId || '',
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (eventType === 'transaction.completed' && !alreadyAppliedTx) {
          const currentCredits =
            typeof existingData.credits === 'number' ? existingData.credits : 0;
          updatePayload.credits = currentCredits + creditsForPlan;
          if (txId) {
            updatePayload.lastOrderId = txId;
            const txDocRef = userRef.collection('transactions').doc(txId);
            tx.set(
              txDocRef,
              {
                userId,
                orderId: txId,
                planId: resolvedPlan,
                creditsAdded: creditsForPlan,
                amountUsd,
                status: 'COMPLETED',
                createdAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
        }

        if (!userSnap.exists) {
          updatePayload.createdAt = FieldValue.serverTimestamp();
        }

        tx.set(userRef, updatePayload, { merge: true });
      });

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (eventType === 'subscription.canceled') {
      await userRef.set(
        {
          plan: 'free',
          subscriptionStatus: 'canceled',
          isPaid: false,
          paddleCustomerId: data.customer_id || '',
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

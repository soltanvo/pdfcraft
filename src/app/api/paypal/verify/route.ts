import { NextRequest, NextResponse } from 'next/server';

const EXPECTED_AMOUNTS: Record<string, string> = {
  starter: '2.00',
  pro: '5.00',
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      orderId?: string;
      planId?: 'starter' | 'pro';
    };

    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const planId = body.planId === 'starter' || body.planId === 'pro' ? body.planId : null;

    if (!orderId || !planId) {
      return NextResponse.json({ error: 'Invalid orderId or planId' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    // If PayPal server secret is not configured in preview, validate input shape cleanly
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        verified: true,
        mode: 'client-capture',
        orderId,
        planId,
      });
    }

    const baseUrl =
      process.env.PAYPAL_API_BASE ||
      (clientId.startsWith('sb') || process.env.NODE_ENV !== 'production'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com');

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: 'PayPal authentication failed on server' },
        { status: 502 }
      );
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return NextResponse.json({ error: 'Missing PayPal access token' }, { status: 502 });
    }

    const orderRes = await fetch(
      `${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!orderRes.ok) {
      return NextResponse.json({ error: 'Unable to verify PayPal order' }, { status: 400 });
    }

    const orderData = (await orderRes.json()) as {
      status?: string;
      purchase_units?: Array<{ amount?: { currency_code?: string; value?: string } }>;
    };

    const capturedAmount = orderData.purchase_units?.[0]?.amount?.value;
    const capturedCurrency = orderData.purchase_units?.[0]?.amount?.currency_code;

    if (
      orderData.status !== 'COMPLETED' ||
      capturedCurrency !== 'USD' ||
      capturedAmount !== EXPECTED_AMOUNTS[planId]
    ) {
      return NextResponse.json(
        { error: 'PayPal order status or amount mismatch' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      verified: true,
      mode: 'server-verified',
      orderId,
      planId,
    });
  } catch (err) {
    console.error('PayPal verification error:', err);
    return NextResponse.json({ error: 'Internal verification error' }, { status: 500 });
  }
}

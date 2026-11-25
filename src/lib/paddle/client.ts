'use client';

import { initializePaddle, type Paddle } from '@paddle/paddle-js';

export interface PaidPlanConfig {
  id: 'starter' | 'pro';
  priceId: string;
  priceDisplay: string;
  credits: number;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  popular?: boolean;
  featuresAr: string[];
  featuresEn: string[];
}

export const PAID_PLANS: PaidPlanConfig[] = [
  {
    id: 'starter',
    priceId: 'pri_01m858qhsdhzkjbs0tvebhzbjd',
    priceDisplay: '$2',
    credits: 30,
    titleAr: 'باقة البداية',
    titleEn: 'Starter Plan',
    subtitleAr: 'اشتراك شهري مثالي للاستخدام اليومي وأدوات الذكاء الاصطناعي',
    subtitleEn: 'Monthly plan ideal for daily PDF & AI chat workflows',
    featuresAr: [
      '30 نقطة ذكاء اصطناعي شهرياً',
      'إزالة العلامة المائية SA AI تلقائياً',
      'استخدام جميع أدوات الذكاء الاصطناعي',
      'دعم رفع الصور والملفات في الشات',
    ],
    featuresEn: [
      '30 AI & document credits / month',
      'Automatic SA AI watermark removal',
      'Access to all AI assistant tools',
      'Image & PDF/TXT file upload in chat',
    ],
  },
  {
    id: 'pro',
    priceId: 'pri_01m85912qp3z4d2bjfgp7v530v',
    priceDisplay: '$5',
    credits: 100,
    titleAr: 'باقة المحترفين',
    titleEn: 'Pro Plan',
    subtitleAr: 'اشتراك شهري بأفضل قيمة وأولوية قصوى للمحترفين والشركات',
    subtitleEn: 'Best value monthly plan with maximum credits and priority',
    popular: true,
    featuresAr: [
      '100 نقطة شهرياً (توفير أكبر)',
      'إزالة العلامة المائية SA AI تلقائياً',
      'استخدام غير محدود لأدوات الذكاء الاصطناعي والـ PDF',
      'أولوية قصوى في المعالجة',
    ],
    featuresEn: [
      '100 credits / month (Best value)',
      'Automatic SA AI watermark removal',
      'Full access to AI & 130+ PDF tools',
      'Top processing priority',
    ],
  },
];

function sanitizeEnv(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^["']+|["']+$/g, '').trim();
}

export function resolvePaddleConfig(): { token: string; environment: 'sandbox' | 'production' } {
  const token = sanitizeEnv(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN);
  const explicitEnv = sanitizeEnv(process.env.NEXT_PUBLIC_PADDLE_ENV).toLowerCase();
  const environment: 'sandbox' | 'production' =
    explicitEnv === 'sandbox' || token.startsWith('test_') ? 'sandbox' : 'production';
  return { token, environment };
}

type PaddleGlobal = Paddle & {
  Initialized?: boolean;
  Environment: { set: (env: 'sandbox' | 'production') => void };
  Initialize: (opts: { token: string; eventCallback?: (event: { name?: string }) => void }) => void;
  Update: (opts: { token: string; eventCallback?: (event: { name?: string }) => void }) => void;
};

export async function loadPaddleScriptDirect(
  token: string,
  environment: 'sandbox' | 'production',
  onCompleted: () => void
): Promise<Paddle | null> {
  if (typeof window === 'undefined') return null;

  const win = window as unknown as {
    PaddleBillingV1?: PaddleGlobal;
    Paddle?: PaddleGlobal;
  };

  let instance = win.PaddleBillingV1 || win.Paddle;
  if (!instance) {
    const cdnUrl = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    const existing = document.querySelector(`script[src="${cdnUrl}"]`);
    if (existing) {
      existing.remove();
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = cdnUrl;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Paddle.js from cdn.paddle.com'));
      (document.head || document.body).appendChild(script);
    });

    instance = win.PaddleBillingV1 || win.Paddle;
  }

  if (!instance) {
    return null;
  }

  instance.Environment.set(environment);
  const initOpts = {
    token,
    eventCallback(event: { name?: string }) {
      if (event.name === 'checkout.completed') {
        onCompleted();
      }
    },
  };
  if (instance.Initialized) {
    instance.Update(initOpts);
  } else {
    instance.Initialize(initOpts);
  }
  return instance;
}

export async function getOrInitPaddleInstance(onCompleted: () => void): Promise<Paddle | null> {
  const { token, environment } = resolvePaddleConfig();
  if (!token) {
    return null;
  }

  try {
    const instance = await initializePaddle({
      environment,
      token,
      eventCallback(event) {
        if (event.name === 'checkout.completed') {
          onCompleted();
        }
      },
    });
    if (instance) {
      return instance;
    }
  } catch (sdkErr) {
    console.warn('Primary Paddle CDN load failed, retrying direct script:', sdkErr);
  }

  return loadPaddleScriptDirect(token, environment, onCompleted);
}

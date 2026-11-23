'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PayPalButtons,
  PayPalScriptProvider,
  usePayPalScriptReducer,
} from '@paypal/react-paypal-js';
import { Check, CheckCircle2, Coins, Crown, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface PaidPlanConfig {
  id: 'starter' | 'pro';
  price: string;
  credits: number;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  popular?: boolean;
  featuresAr: string[];
  featuresEn: string[];
}

const PAID_PLANS: PaidPlanConfig[] = [
  {
    id: 'starter',
    price: '2.00',
    credits: 30,
    titleAr: 'باقة البداية',
    titleEn: 'Starter Plan',
    subtitleAr: 'مثالية للاستخدام اليومي وأدوات الذكاء الاصطناعي',
    subtitleEn: 'Ideal for daily documents and AI chat workflows',
    featuresAr: [
      '30 نقطة ذكاء اصطناعي',
      'إزالة العلامة المائية SA AI تلقائياً',
      'استخدام جميع أدوات الذكاء الاصطناعي',
      'دعم رفع الصور والملفات في الشات',
    ],
    featuresEn: [
      '30 AI & document credits',
      'Automatic SA AI watermark removal',
      'Access to all AI assistant tools',
      'Image & PDF/TXT file upload in chat',
    ],
  },
  {
    id: 'pro',
    price: '5.00',
    credits: 100,
    titleAr: 'باقة المحترفين',
    titleEn: 'Pro Plan',
    subtitleAr: 'توفير أكبر وأولوية قصوى للمحترفين والشركات',
    subtitleEn: 'Best value with maximum savings and top priority',
    popular: true,
    featuresAr: [
      '100 نقطة (توفير أكبر)',
      'إزالة العلامة المائية SA AI تلقائياً',
      'استخدام غير محدود لأدوات الذكاء الاصطناعي والـ PDF',
      'أولوية قصوى في المعالجة',
    ],
    featuresEn: [
      '100 credits (Best value)',
      'Automatic SA AI watermark removal',
      'Full access to AI & 130+ PDF tools',
      'Top processing priority',
    ],
  },
];

function PlanPayPalCheckout({
  plan,
  locale,
  onSuccess,
  onError,
}: {
  plan: PaidPlanConfig;
  locale: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { user, signInWithGoogle, addPaidCredits } = useAuth();
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  const [busy, setBusy] = useState(false);
  const isArabic = locale === 'ar';
  const hasPayPalClientId = Boolean((process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '').trim());

  if (!hasPayPalClientId) {
    return (
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-center">
        {isArabic
          ? 'بوابة PayPal غير مفعّلة بعد. أضف NEXT_PUBLIC_PAYPAL_CLIENT_ID في إعدادات البيئة.'
          : 'PayPal checkout is not configured. Set NEXT_PUBLIC_PAYPAL_CLIENT_ID in environment variables.'}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {!user && (
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
        >
          {isArabic
            ? 'سجّل الدخول بحساب Google أولاً أو اضغط زر PayPal مباشرة'
            : 'Sign in with Google first or click PayPal below'}
        </button>
      )}

      {busy && (
        <div className="text-xs text-center text-blue-700 font-medium py-1">
          {isArabic ? 'جارٍ تأكيد الدفع وإضافة النقاط...' : 'Confirming payment & adding credits...'}
        </div>
      )}

      {isPending && (
        <div className="h-11 w-full rounded-xl bg-slate-100 animate-pulse" />
      )}

      {isRejected && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-center">
          {isArabic
            ? 'تعذر تحميل أزرار PayPal. تحقق من صلاحية NEXT_PUBLIC_PAYPAL_CLIENT_ID.'
            : 'Could not load PayPal buttons. Check NEXT_PUBLIC_PAYPAL_CLIENT_ID.'}
        </div>
      )}

      <PayPalButtons
        forceReRender={[user?.uid ?? 'guest', plan.id, plan.price]}
        style={{
          layout: 'vertical',
          color: plan.popular ? 'gold' : 'blue',
          shape: 'rect',
          label: 'pay',
          height: 44,
        }}
        onClick={async (_data, actions) => {
          onError('');
          if (!user) {
            const signedIn = await signInWithGoogle();
            if (!signedIn) {
              onError(
                isArabic
                  ? 'يرجى تسجيل الدخول بحساب Google لإتمام عملية الشراء وإضافة النقاط لحسابك.'
                  : 'Please sign in with Google to complete checkout and credit your account.'
              );
              return actions.reject();
            }
          }
          return actions.resolve();
        }}
        createOrder={(_data, actions) => {
          return actions.order.create({
            intent: 'CAPTURE',
            purchase_units: [
              {
                description: `SA AI - ${plan.titleEn} (${plan.credits} Credits)`,
                amount: {
                  currency_code: 'USD',
                  value: plan.price,
                },
              },
            ],
          });
        }}
        onApprove={async (data, actions) => {
          setBusy(true);
          try {
            const details = await actions.order?.capture();
            const orderId = details?.id || data.orderID || `pp_${Date.now()}`;

            const verifyRes = await fetch('/api/paypal/verify/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId, planId: plan.id }),
            });

            if (!verifyRes.ok) {
              const errBody = (await verifyRes.json().catch(() => ({}))) as { error?: string };
              throw new Error(errBody.error || 'Payment verification failed');
            }

            await addPaidCredits(plan.id, orderId);
            onSuccess(
              isArabic
                ? `تمت عملية الدفع بنجاح! تمت إضافة ${plan.credits} نقطة وإزالة العلامة المائية من حسابك.`
                : `Payment complete! Added ${plan.credits} credits and enabled watermark-free exports.`
            );
          } catch (err) {
            onError(
              err instanceof Error
                ? err.message
                : isArabic
                ? 'تعذر إتمام عملية الدفع. يرجى المحاولة مرة أخرى.'
                : 'Could not complete PayPal checkout.'
            );
          } finally {
            setBusy(false);
          }
        }}
        onError={(err) => {
          console.error('PayPal button error:', err);
          onError(
            isArabic
              ? 'حدث خطأ في بوابة PayPal. تأكد من تفعيل معرف العميل واتصال الإنترنت.'
              : 'PayPal encountered an error. Please try again.'
          );
        }}
      />
    </div>
  );
}

export function PricingPageClient({ locale }: { locale: string }) {
  const isArabic = locale === 'ar';
  const { user, credits, isPaid, signInWithGoogle } = useAuth();
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const paypalClientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "").trim();

  return (
    <PayPalScriptProvider
      deferLoading={!paypalClientId}
      options={{
        clientId: (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "").trim(),
        currency: "USD",
        intent: "capture",
      }}
    >
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
              {isArabic
                ? 'باقات مرنة تناسب احتياجاتك في SA AI'
                : 'Simple, Transparent Pricing for SA AI'}
            </h1>
            <p className="text-base sm:text-lg text-slate-600">
              {isArabic
                ? 'ابدأ مجاناً بـ 5 نقاط، أو اشحن رصيدك عبر PayPal لإزالة العلامة المائية SA AI والحصول على استخدام كامل لأدوات الذكاء الاصطناعي والـ PDF.'
                : 'Start free with 5 credits, or top up via PayPal to remove the SA AI watermark automatically and unlock full AI Studio capabilities.'}
            </p>

            {/* Active User Credits Strip */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              {user ? (
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-xs text-sm">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {isArabic ? `رصيدك الحالي: ${credits} نقطة` : `Current Balance: ${credits} Credits`}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className={isPaid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                    {isPaid
                      ? isArabic
                        ? 'حساب مدفوع (بدون علامة مائية)'
                        : 'Paid Account (Watermark-Free)'
                      : isArabic
                      ? 'خطة مجانية'
                      : 'Free Tier'}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>
                    {isArabic
                      ? 'سجّل الدخول بحساب Google واحصل على 5 نقاط مجانية'
                      : 'Sign in with Google for 5 free credits'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback Banners */}
          {successMsg && (
            <div className="max-w-3xl mx-auto flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="max-w-3xl mx-auto flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 3 White Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
            {/* 1. Free Plan ($0) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-7 flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {isArabic ? 'الباقة المجانية' : 'Free Plan'}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500">
                    {isArabic
                      ? 'للتجربة السريعة ومعالجة ملفات PDF اليومية'
                      : 'Great for quick trials and everyday PDF tasks'}
                  </p>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold text-slate-900 tabular-nums" dir="ltr">
                    $0
                  </span>
                  <span className="text-sm text-slate-500">
                    {isArabic ? '/ مجاناً للأبد' : '/ forever free'}
                  </span>
                </div>

                <ul className="space-y-3.5 text-sm text-slate-700 border-t border-slate-100 pt-6">
                  {(isArabic
                    ? [
                        '5 نقاط مجانية عند التسجيل',
                        'الوصول لأكثر من 130 أداة PDF',
                        'معالجة سريعة داخل المتصفح',
                        'تتضمن علامة SA AI المائية عند التحميل',
                      ]
                    : [
                        '5 free credits on sign-up',
                        'Access to 130+ PDF tools',
                        'Fast browser-based processing',
                        'Includes SA AI watermark on download',
                      ]
                  ).map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8">
                <Link
                  href={`/${locale}/tools`}
                  className="w-full inline-flex items-center justify-center py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors"
                >
                  {isArabic ? 'ابدأ مجاناً' : 'Start Free'}
                </Link>
              </div>
            </div>

            {/* 2. Starter Plan ($2) & 3. Pro Plan ($5) */}
            {PAID_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl p-6 lg:p-7 flex flex-col justify-between relative ${
                  plan.popular
                    ? 'border-2 border-amber-400 shadow-lg'
                    : 'border border-slate-200 shadow-sm'
                }`}
              >
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xl font-bold text-slate-900">
                        {isArabic ? plan.titleAr : plan.titleEn}
                      </h2>
                      {plan.popular && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                          <Crown className="w-3.5 h-3.5 text-amber-600" />
                          {isArabic ? 'الأكثر طلباً' : 'Most Popular'}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {isArabic ? plan.subtitleAr : plan.subtitleEn}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-slate-900 tabular-nums" dir="ltr">
                      ${plan.id === 'starter' ? '2' : '5'}
                    </span>
                    <span className="text-sm text-slate-500 tabular-nums">
                      {isArabic ? `/ ${plan.credits} نقطة` : `/ ${plan.credits} credits`}
                    </span>
                  </div>

                  <ul className="space-y-3.5 text-sm text-slate-700 border-t border-slate-100 pt-6">
                    {(isArabic ? plan.featuresAr : plan.featuresEn).map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  <PlanPayPalCheckout
                    plan={plan}
                    locale={locale}
                    onSuccess={(msg) => {
                      setErrorMsg('');
                      setSuccessMsg(msg);
                    }}
                    onError={(msg) => {
                      if (msg) setSuccessMsg('');
                      setErrorMsg(msg);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Trust Footer Note */}
          <div className="text-center flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {isArabic
                ? 'مدفوعات آمنة عبر PayPal • تتم إضافة النقاط وإزالة العلامة المائية فورياً في حسابك'
                : 'Secure PayPal checkout • Credits and watermark-free status apply immediately'}
            </span>
          </div>
        </div>
      </div>
    </PayPalScriptProvider>
  );
}

export default PricingPageClient;

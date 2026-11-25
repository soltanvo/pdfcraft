'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coins,
  Crown,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase/config';
import {
  loadPaddleScriptDirect,
  PAID_PLANS,
  resolvePaddleConfig,
  type PaidPlanConfig,
} from '@/lib/paddle/client';

export function PricingPageClient({ locale }: { locale: string }) {
  const isArabic = locale === 'ar';
  const { user, profile, credits, isPaid, signInWithGoogle } = useAuth();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [paddleInitError, setPaddleInitError] = useState<string>('');
  const [openingPlan, setOpeningPlan] = useState<'starter' | 'pro' | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const { token, environment } = resolvePaddleConfig();
    if (!token) {
      return;
    }

    let cancelled = false;
    const handleCompleted = () => {
      setSuccessMsg(
        isArabic
          ? 'تم إتمام الاشتراك بنجاح! سيتم تفعيل الباقة وتحديث حسابك خلال لحظات.'
          : 'Subscription payment complete! Your plan and credits are activating now.'
      );
    };

    const bootPaddle = async () => {
      try {
        const instance = await initializePaddle({
          environment,
          token,
          eventCallback(event) {
            if (event.name === 'checkout.completed') {
              handleCompleted();
            }
          },
        });
        if (instance) {
          if (!cancelled) {
            setPaddle(instance);
            setPaddleInitError('');
          }
          return;
        }
      } catch (sdkErr) {
        console.warn('Primary Paddle CDN load failed, retrying direct script:', sdkErr);
      }

      try {
        const fallbackInstance = await loadPaddleScriptDirect(token, environment, handleCompleted);
        if (fallbackInstance && !cancelled) {
          setPaddle(fallbackInstance);
          setPaddleInitError('');
          return;
        }
      } catch (fallbackErr) {
        console.error('Paddle initialization error:', fallbackErr);
      }

      if (!cancelled) {
        setPaddleInitError(
          isArabic
            ? 'تعذر تحميل بوابة الدفع Paddle. تأكد من عدم وجود مانع إعلانات وتأكد من صحة NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.'
            : 'Unable to load Paddle checkout script. Disable any ad blocker and verify NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.'
        );
      }
    };

    void bootPaddle();

    return () => {
      cancelled = true;
    };
  }, [isArabic]);

  const handleSubscribe = async (plan: PaidPlanConfig) => {
    setErrorMsg('');
    setSuccessMsg('');
    setOpeningPlan(plan.id);

    try {
      const currentUser = auth?.currentUser || user;
      if (!currentUser) {
        await signInWithGoogle();
        return;
      }

      let activePaddle = paddle;
      if (!activePaddle) {
        const { token, environment } = resolvePaddleConfig();
        if (!token) {
          setErrorMsg(
            isArabic
              ? 'مفتاح بوابة الدفع NEXT_PUBLIC_PADDLE_CLIENT_TOKEN غير مضبوط في إعدادات البيئة.'
              : 'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not configured in environment variables.'
          );
          return;
        }
        const handleCompleted = () => {
          setSuccessMsg(
            isArabic
              ? 'تم إتمام الاشتراك بنجاح! سيتم تفعيل الباقة وتحديث حسابك خلال لحظات.'
              : 'Subscription payment complete! Your plan and credits are activating now.'
          );
        };
        try {
          activePaddle =
            (await initializePaddle({
              environment,
              token,
              eventCallback(event) {
                if (event.name === 'checkout.completed') {
                  handleCompleted();
                }
              },
            })) || null;
        } catch {
          activePaddle = null;
        }
        if (!activePaddle) {
          activePaddle = await loadPaddleScriptDirect(token, environment, handleCompleted);
        }
        if (activePaddle) {
          setPaddle(activePaddle);
          setPaddleInitError('');
        }
      }

      if (!activePaddle) {
        setErrorMsg(
          paddleInitError ||
            (isArabic
              ? 'تعذر فتح نافذة الدفع عبر Paddle. حاول مرة أخرى.'
              : 'Unable to open Paddle checkout. Please try again.')
        );
        return;
      }

      const selectedPriceId = plan.priceId;
      const selectedPlan = plan.id;

      activePaddle.Checkout.open({
        items: [{ priceId: selectedPriceId, quantity: 1 }],
        customer: currentUser.email ? { email: currentUser.email } : undefined,
        customData: {
          userId: currentUser.uid,
          plan: selectedPlan,
        },
        settings: {
          displayMode: 'overlay',
          successUrl: `${window.location.origin}/?payment=success`,
        },
      });
    } catch (err) {
      console.error('Paddle Checkout open error:', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isArabic
          ? 'حدث خطأ أثناء فتح نافذة الدفع.'
          : 'An error occurred while opening checkout.'
      );
    } finally {
      setOpeningPlan(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            {isArabic
              ? 'باقات الاشتراك الشهرية في SA AI'
              : 'Simple, Transparent Pricing for SA AI'}
          </h1>
          <p className="text-base sm:text-lg text-slate-600">
            {isArabic
              ? 'ابدأ مجاناً بـ 5 نقاط، أو اشترك شهرياً عبر Paddle لإزالة العلامة المائية SA AI وتفعيل كافة أدوات الذكاء الاصطناعي والـ PDF.'
              : 'Start free with 5 credits, or subscribe monthly via Paddle to remove the SA AI watermark automatically and unlock full AI Studio access.'}
          </p>

          {/* Active User Credits & Plan Strip */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {user ? (
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-xs text-sm">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-slate-900 tabular-nums">
                  {isArabic ? `رصيدك الحالي: ${credits} نقطة` : `Current Balance: ${credits} Credits`}
                </span>
                <span className="text-slate-300">|</span>
                <span className={isPaid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                  {profile?.plan === 'pro' && profile?.subscriptionStatus === 'active'
                    ? isArabic
                      ? 'مشترك: باقة المحترفين'
                      : 'Active: Pro Plan'
                    : profile?.plan === 'starter' && profile?.subscriptionStatus === 'active'
                    ? isArabic
                      ? 'مشترك: باقة البداية'
                      : 'Active: Starter Plan'
                    : isPaid
                    ? isArabic
                      ? 'حساب مدفوع (بدون علامة مائية)'
                      : 'Paid Account (Watermark-Free)'
                    : isArabic
                    ? 'الباقة المجانية'
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
                    ? 'سجّل الدخول بحساب Google أولاً للاشتراك والحصول على 5 نقاط مجانية'
                    : 'Sign in with Google first to subscribe & get 5 free credits'}
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

        {(errorMsg || paddleInitError) && (
          <div className="max-w-3xl mx-auto flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg || paddleInitError}</span>
          </div>
        )}

        {/* 3 White Pricing Cards in One Horizontal Row */}
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

          {/* 2. Starter Plan ($2/month) & 3. Pro Plan ($5/month) */}
          {PAID_PLANS.map((plan) => {
            const isCurrentPlan =
              profile?.plan === plan.id && profile?.subscriptionStatus === 'active';
            const isOpening = openingPlan === plan.id;

            return (
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
                      {plan.priceDisplay}
                    </span>
                    <span className="text-sm text-slate-500">
                      {isArabic ? '/ شهرياً' : '/ month'}
                    </span>
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md tabular-nums">
                      {isArabic ? `${plan.credits} نقطة` : `${plan.credits} credits`}
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
                  <button
                    type="button"
                    disabled={isOpening || isCurrentPlan}
                    onClick={() => void handleSubscribe(plan)}
                    className={`w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-sm transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      plan.popular
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isOpening ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          {isArabic ? 'جارٍ فتح بوابة الدفع...' : 'Opening Checkout...'}
                        </span>
                      </>
                    ) : isCurrentPlan ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isArabic ? 'اشتراكك الحالي النشط' : 'Current Active Plan'}</span>
                      </>
                    ) : (
                      <span>
                        {user
                          ? isArabic
                            ? `اشترك الآن (${plan.priceDisplay}/شهر)`
                            : `Subscribe Now (${plan.priceDisplay}/mo)`
                          : isArabic
                          ? `سجّل الدخول واشترك (${plan.priceDisplay}/شهر)`
                          : `Sign In & Subscribe (${plan.priceDisplay}/mo)`}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Footer Note */}
        <div className="text-center flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>
            {isArabic
              ? 'مدفوعات آمنة وتفعيل تلقائي عبر Paddle • ضمان استرداد خلال 7 أيام •'
              : 'Secure automated billing via Paddle • 7-day refund policy •'}
          </span>
          <Link href="/refunds" className="text-blue-700 hover:underline font-medium">
            {isArabic ? 'سياسة الاسترداد' : 'Refund Policy'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PricingPageClient;

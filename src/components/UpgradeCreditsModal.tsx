'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Paddle } from '@paddle/paddle-js';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Coins,
  Crown,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import {
  getOrInitPaddleInstance,
  PAID_PLANS,
  resolvePaddleConfig,
  type PaidPlanConfig,
} from '@/lib/paddle/client';

interface UpgradeCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  availableCredits: number;
  requiredCredits: 1 | 2;
}

export function UpgradeCreditsModal({
  isOpen,
  onClose,
  locale,
  availableCredits,
  requiredCredits,
}: UpgradeCreditsModalProps) {
  const isArabic = locale === 'ar';
  const dir = locale === 'ar' || locale === 'he' ? 'rtl' : 'ltr';
  const { user, profile, signInWithGoogle } = useAuth();

  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [openingPlan, setOpeningPlan] = useState<'starter' | 'pro' | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const { token } = resolvePaddleConfig();
    if (!token || paddle) return;

    let cancelled = false;
    void getOrInitPaddleInstance(() => {
      if (!cancelled) {
        setCheckoutSuccess(
          isArabic
            ? 'تم الاشتراك بنجاح! جارٍ إضافة النقاط لحسابك الآن...'
            : 'Payment complete! Adding credits to your account now...'
        );
      }
    })
      .then((instance) => {
        if (instance && !cancelled) {
          setPaddle(instance);
        }
      })
      .catch(() => {
        // Fallback handled on click
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, isArabic, paddle]);

  if (!isOpen) return null;

  const handlePlanCheckout = async (plan: PaidPlanConfig) => {
    setCheckoutError('');
    setCheckoutSuccess('');
    setOpeningPlan(plan.id);

    try {
      if (!user) {
        await signInWithGoogle();
        return;
      }

      const { token } = resolvePaddleConfig();
      if (!token) {
        window.location.href = `/${locale}/pricing`;
        return;
      }

      let activePaddle = paddle;
      if (!activePaddle) {
        activePaddle = await getOrInitPaddleInstance(() => {
          setCheckoutSuccess(
            isArabic
              ? 'تم الاشتراك بنجاح! جارٍ إضافة النقاط لحسابك الآن...'
              : 'Payment complete! Adding credits to your account now...'
          );
        });
        if (activePaddle) {
          setPaddle(activePaddle);
        }
      }

      if (!activePaddle) {
        setCheckoutError(
          isArabic
            ? 'تعذر فتح نافذة الدفع مباشرة. يمكنك المتابعة عبر صفحة الباقات.'
            : 'Could not open direct checkout overlay. Please continue on the Pricing page.'
        );
        return;
      }

      activePaddle.Checkout.open({
        items: [{ priceId: plan.priceId, quantity: 1 }],
        customer: user.email ? { email: user.email } : undefined,
        customData: {
          userId: user.uid,
          plan: plan.id,
        },
        settings: {
          displayMode: 'overlay',
          successUrl: `${window.location.origin}/${locale}/ai?payment=success`,
        },
      });
    } catch (err) {
      setCheckoutError(
        err instanceof Error
          ? err.message
          : isArabic
          ? 'حدث خطأ أثناء فتح بوابة الدفع. جرب صفحة الباقات.'
          : 'Failed to open checkout. Try opening the Pricing page.'
      );
    } finally {
      setOpeningPlan(null);
    }
  };

  const isPdfShortfall = availableCredits > 0 && availableCredits < requiredCredits;

  return (
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-credits-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="tabular-nums">
                {isArabic
                  ? `رصيدك الحالي: ${availableCredits} نقطة · المطلوب: ${requiredCredits} ${
                      requiredCredits === 2 ? 'نقطتان' : 'نقطة'
                    }`
                  : `Balance: ${availableCredits} credits · Required: ${requiredCredits}`}
              </span>
            </div>
            <h2
              id="upgrade-credits-modal-title"
              className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight"
            >
              {isArabic
                ? 'رصيد نقاطك غير كافٍ - اختر باقتك للمتابعة'
                : 'Insufficient Credits — Choose Your Plan to Continue'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {isPdfShortfall
                ? isArabic
                  ? `تحليل الملفات والصور يتطلب ${requiredCredits} نقطة، بينما رصيدك الحالي ${availableCredits} نقطة فقط.`
                  : `Analyzing files or images costs ${requiredCredits} credits, and you currently have ${availableCredits} credit left.`
                : isArabic
                ? 'رصيدك الحالي 0 نقطة. اشترك في إحدى الباقات أدناه عبر Paddle للحصول على نقاط إضافية ومتابعة المحادثة فوراً.'
                : 'Your balance is 0 credits. Subscribe below via Paddle to top up your credits and continue immediately.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isArabic ? 'إغلاق' : 'Close'}
            className="w-9 h-9 rounded-full text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 bg-slate-50/70 dark:bg-slate-950/50">
          {checkoutSuccess && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{checkoutSuccess}</span>
            </div>
          )}

          {checkoutError && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{checkoutError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            {PAID_PLANS.map((plan) => {
              const isCurrentPlan =
                profile?.plan === plan.id && profile?.subscriptionStatus === 'active';
              const isOpening = openingPlan === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl bg-white dark:bg-slate-900 p-5 flex flex-col justify-between transition-shadow ${
                    plan.popular
                      ? 'border-2 border-indigo-500 dark:border-indigo-400 shadow-md'
                      : 'border border-slate-200 dark:border-slate-800 shadow-xs'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {isArabic ? plan.titleAr : plan.titleEn}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {isArabic ? `${plan.credits} نقطة شهرياً` : `${plan.credits} credits / month`}
                        </p>
                      </div>
                      {plan.popular && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md whitespace-nowrap">
                          <Crown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          {isArabic ? 'الأفضل قيمة' : 'Best Value'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span
                        className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums"
                        dir="ltr"
                      >
                        {plan.priceDisplay}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {isArabic ? '/ شهرياً' : '/ month'}
                      </span>
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-600">·</span>
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                        {isArabic ? `${plan.credits} نقطة` : `${plan.credits} pts`}
                      </span>
                    </div>

                    <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-3">
                      {(isArabic ? plan.featuresAr : plan.featuresEn).slice(0, 3).map((feat) => (
                        <li key={feat} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-5">
                    <button
                      type="button"
                      disabled={isOpening || isCurrentPlan}
                      onClick={() => void handlePlanCheckout(plan)}
                      className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        plan.popular
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs'
                          : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900'
                      }`}
                    >
                      {isOpening ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{isArabic ? 'جارٍ فتح الدفع...' : 'Opening Checkout...'}</span>
                        </>
                      ) : isCurrentPlan ? (
                        <span>{isArabic ? 'باقتك الحالية' : 'Current Plan'}</span>
                      ) : (
                        <span>
                          {isArabic
                            ? `اشترك الآن (${plan.priceDisplay} / ${plan.credits} نقطة)`
                            : `Upgrade (${plan.priceDisplay} / ${plan.credits} pts)`}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with Direct Link to /pricing */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {isArabic
                ? 'دفع آمن عبر Paddle · تفعيل فوري للنقاط'
                : 'Secure Paddle billing · Instant credit activation'}
            </span>
          </div>

          <Link
            href={`/${locale}/pricing`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
          >
            <span>{isArabic ? 'عرض صفحة الباقات' : 'Go to Pricing Page'}</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, X } from 'lucide-react';

export function PaymentSuccessBanner({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || searchParams.get('payment') !== 'success') {
    return null;
  }

  const isArabic = locale === 'ar';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-xs">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            {isArabic
              ? 'تم إتمام الدفع وتفعيل اشتراكك بنجاح! يمكنك الآن استخدام كافة الأدوات بدون علامة مائية.'
              : 'Payment completed successfully! Your subscription and credits are now active without watermarks.'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

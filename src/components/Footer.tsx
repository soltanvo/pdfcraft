'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export function Footer({ locale }: { locale: string }) {
  const t = useTranslations('common');
  const isArabic = locale === 'ar';

  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <Link href={`/${locale}`} className="inline-flex">
              <BrandLogo />
            </Link>
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{t('footer.privacyBadge')}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
            <Link href={`/${locale}`} className="hover:text-blue-600 transition-colors">
              {isArabic ? 'الرئيسية' : t('navigation.home')}
            </Link>
            <Link href={`/${locale}/tools`} className="hover:text-blue-600 transition-colors">
              {isArabic ? 'الأدوات' : t('navigation.tools')}
            </Link>
            <Link href={`/${locale}/ai`} className="hover:text-blue-600 transition-colors">
              {isArabic ? 'الذكاء الاصطناعي' : t('navigation.aiTools')}
            </Link>
            <Link href={`/${locale}/pricing`} className="hover:text-blue-600 transition-colors">
              {isArabic ? 'الباقات' : 'Pricing'}
            </Link>
            <Link href={`/${locale}/workflow`} className="hover:text-blue-600 transition-colors">
              {t('navigation.workflow')}
            </Link>
            <Link href={`/${locale}/about`} className="hover:text-blue-600 transition-colors">
              {isArabic ? 'من نحن' : t('navigation.about')}
            </Link>
            <Link href={`/${locale}/faq`} className="hover:text-blue-600 transition-colors">
              {t('navigation.faq')}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-blue-600 transition-colors">
              {t('navigation.privacy')}
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} SA AI. {isArabic ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}</p>
          <p>
            {isArabic
              ? 'معالجة ذكية وسريعة لملفات PDF داخل المتصفح مدعومة بالذكاء الاصطناعي'
              : 'AI-Powered Document Studio & Client-Side PDF Processing'}
          </p>
        </div>
      </div>
    </footer>
  );
}

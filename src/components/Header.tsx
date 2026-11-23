'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { AlertCircle, Coins, Globe, LogIn, LogOut, Menu, User as UserIcon, X } from 'lucide-react';
import { useState } from 'react';
import { locales, localeConfig, type Locale } from '@/lib/i18n/config';
import { auth } from '@/lib/firebase/config';
import { BrandLogo } from './BrandLogo';
import { useAuth } from './AuthProvider';

export function Header({ locale }: { locale: string }) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const { user, profile, credits, loading, authBusy, error, clearError, logout } = useAuth();

  const isArabic = locale === 'ar';
  const busy = authBusy || signingIn;
  const activeError = localError || error;

  const navItems = [
    { href: `/${locale}`, label: isArabic ? 'الرئيسية' : t('navigation.home') },
    { href: `/${locale}/tools`, label: isArabic ? 'الأدوات' : t('navigation.tools') },
    { href: `/${locale}/ai`, label: isArabic ? 'الذكاء الاصطناعي' : t('navigation.aiTools') },
    { href: `/${locale}/pricing`, label: isArabic ? 'الباقات' : 'Pricing' },
    { href: `/${locale}/about`, label: isArabic ? 'من نحن' : t('navigation.about') },
  ];

  const handleLocaleChange = (nextLocale: string) => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0 && (locales as readonly string[]).includes(segments[0])) {
      segments[0] = nextLocale;
    } else {
      segments.unshift(nextLocale);
    }
    router.push('/' + segments.join('/'));
  };

  const handleDirectGoogleSignIn = async () => {
    setLocalError(null);
    clearError();
    setSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      console.error('Google signInWithPopup error:', err);
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : '';
      const isPopupBlocked =
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-browser' ||
        (/popup/i.test(message) && /block/i.test(message));

      if (isPopupBlocked) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: unknown) {
          console.error('Google signInWithRedirect error:', redirectErr);
          setLocalError(
            redirectErr instanceof Error
              ? redirectErr.message
              : isArabic
              ? 'تعذر فتح صفحة تسجيل الدخول بجوجل.'
              : 'Could not open Google sign-in redirect.'
          );
          return;
        }
      }

      if (code === 'auth/unauthorized-domain') {
        setLocalError(
          isArabic
            ? 'هذا النطاق غير مضاف في Authorized domains داخل Firebase Authentication. أضف النطاق أو استخدم النطاق الرسمي.'
            : 'This domain is not authorized in Firebase Authentication Authorized Domains.'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setLocalError(
          isArabic
            ? 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.'
            : 'Sign-in popup was closed before completing login.'
        );
      } else {
        setLocalError(
          message ||
            (isArabic ? 'حدث خطأ أثناء تسجيل الدخول بحساب Google.' : 'Google sign-in failed.')
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 h-16 bg-white border-b border-slate-200 whitespace-nowrap">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
        <Link href={`/${locale}`} className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-xl">
          <BrandLogo />
        </Link>

        <nav className="hidden lg:flex items-center gap-1.5">
          {navItems.map((item) => {
            const active =
              item.href === `/${locale}`
                ? pathname === `/${locale}` || pathname === `/${locale}/` || pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-blue-700 bg-blue-50 font-semibold'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative flex items-center">
            <Globe className="w-4 h-4 text-slate-500 absolute start-2.5 pointer-events-none" />
            <select
              aria-label={t('buttons.selectLanguage')}
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              className="ps-8 pe-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-gray-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              {locales.map((loc) => (
                <option key={loc} value={loc}>
                  {localeConfig[loc as Locale].nativeName}
                </option>
              ))}
            </select>
          </div>

          {!loading && user ? (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/${locale}/pricing`}
                title={isArabic ? 'رصيد النقاط الحالي' : 'Current Credits'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold tabular-nums hover:bg-amber-100 transition-colors"
              >
                <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  {credits} {isArabic ? 'نقطة' : 'Credits'}
                </span>
              </Link>

              <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-200 bg-gray-50 max-w-[170px]">
                {profile?.photoURL || user.photoURL ? (
                  <img
                    src={profile?.photoURL || user.photoURL || ''}
                    alt={profile?.displayName || user.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                    <UserIcon className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                )}
                <span className="text-xs font-medium text-slate-800 truncate">
                  {profile?.displayName || user.displayName || user.email}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isArabic ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleDirectGoogleSignIn()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{isArabic ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {activeError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs font-medium text-rose-800 whitespace-normal">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{activeError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                clearError();
              }}
              aria-label="Dismiss error"
              className="p-1 rounded hover:bg-rose-100 text-rose-700 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

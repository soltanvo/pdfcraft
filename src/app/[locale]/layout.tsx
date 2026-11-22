import type { Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { localeConfig, type Locale, locales } from '@/lib/i18n/config';
import { fontVariablesFor } from '@/lib/fonts';
import { SkipLink } from '@/components/common/SkipLink';
import { AuthProvider } from '@/lib/firebase/AuthContext';
import '@/app/globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const direction = localeConfig[locale as Locale]?.direction || 'ltr';

  return (
    <html lang={locale} dir={direction}>
      <head>
        <link rel="icon" href="/logo.png" />
      </head>
      <body className={`${fontVariablesFor(direction)} min-h-screen bg-background text-foreground antialiased font-sans`}>
        <AuthProvider>
          <NextIntlClientProvider messages={messages}>
            <SkipLink targetId="main-content">Skip to main content</SkipLink>
            {children}
          </NextIntlClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

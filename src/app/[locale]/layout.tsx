import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { fontVariablesFor } from '@/lib/fonts';
import { getDirection, isValidLocale, locales } from '@/lib/i18n/config';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const direction = getDirection(locale);

  return (
    <html
      lang={locale}
      dir={direction}
      className={fontVariablesFor(direction)}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/logo.png" type="image/png" />
      </head>
      <body className="min-h-screen flex flex-col bg-white text-slate-900 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <Header locale={locale} />
            <main className="flex-1">{children}</main>
            <Footer locale={locale} />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../messages/en.json';
import { fontVariablesFor } from '@/lib/fonts';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'SA AI - Legal & Compliance',
  description: 'Terms of Service, Privacy Policy, and Refund Policy for SA AI.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className={fontVariablesFor('ltr')} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/logo.png" type="image/png" />
      </head>
      <body className="min-h-screen flex flex-col bg-white text-slate-900 antialiased">
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <AuthProvider>
            <Header locale="en" />
            <main className="flex-1">{children}</main>
            <Footer locale="en" />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

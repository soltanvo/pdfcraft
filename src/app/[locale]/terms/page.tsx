import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';

export const metadata: Metadata = {
  title: 'Terms of Service | SA AI',
};

export default async function LocaleTermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocumentPage kind="terms" locale={locale} />;
}

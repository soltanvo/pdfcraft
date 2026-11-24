import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';

export const metadata: Metadata = {
  title: 'Refund Policy | SA AI',
};

export default async function LocaleRefundsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocumentPage kind="refunds" locale={locale} />;
}

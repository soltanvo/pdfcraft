import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | SA AI',
};

export default async function LocalePrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocumentPage kind="privacy" locale={locale} />;
}

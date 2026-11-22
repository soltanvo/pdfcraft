import { setRequestLocale } from 'next-intl/server';
import AIToolsClient from '@/components/AIToolsClient';

export default async function AiStudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AIToolsClient locale={locale} />;
}

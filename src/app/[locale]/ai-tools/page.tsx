import AIToolsClient from './AIToolsClient';

export default async function AIToolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <AIToolsClient locale={locale} />;
}

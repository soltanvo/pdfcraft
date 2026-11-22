import AIToolsClient from './AIToolsClient';

export default function AIToolsPage({ params: { locale } }: { params: { locale: string } }) {
  return <AIToolsClient locale={locale} />;
}

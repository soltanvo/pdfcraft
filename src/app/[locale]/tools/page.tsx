import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { ToolsCatalogClient } from '@/components/ToolsCatalogClient';

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-12 text-sm text-slate-500">Loading tools...</div>}>
      <ToolsCatalogClient locale={locale} />
    </Suspense>
  );
}

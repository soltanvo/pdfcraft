import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getToolBySlug, TOOLS } from '@/lib/tools/registry';
import { ToolWorkspace } from '@/components/ToolWorkspace';

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ locale: string; tool: string }>;
}) {
  const { locale, tool: slug } = await params;
  setRequestLocale(locale);

  const toolDef = getToolBySlug(slug);
  if (!toolDef) {
    notFound();
  }

  return <ToolWorkspace tool={toolDef} locale={locale} />;
}

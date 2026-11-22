import { setRequestLocale } from 'next-intl/server';
import { WorkflowEditor } from '@/components/WorkflowEditor';

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <WorkflowEditor />;
}

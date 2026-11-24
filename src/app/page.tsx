import { redirect } from 'next/navigation';
import { defaultLocale } from '@/lib/i18n/config';

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const payment = typeof resolvedParams?.payment === 'string' ? resolvedParams.payment : '';
  if (payment === 'success') {
    redirect(`/${defaultLocale}?payment=success`);
  }
  redirect(`/${defaultLocale}`);
}

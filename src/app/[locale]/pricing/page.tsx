import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { locales, type Locale } from '@/lib/i18n/config';
import PricingPageClient from './PricingPageClient';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Pricing | SA AI',
    description: 'Choose the perfect plan for your AI-powered PDF processing.',
  };
}

interface PricingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PricingPage({ params }: PricingPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PricingPageClient locale={locale as Locale} />;
}


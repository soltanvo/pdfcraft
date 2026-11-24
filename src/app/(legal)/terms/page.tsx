import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';

export const metadata: Metadata = {
  title: 'Terms of Service | SA AI',
  description: 'Terms of Service for SA AI PDF and AI Document Studio.',
};

export default function TermsPage() {
  return <LegalDocumentPage kind="terms" locale="en" />;
}

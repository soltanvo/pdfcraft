import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | SA AI',
  description: 'Privacy Policy for SA AI explaining client-side PDF processing, Firebase Auth, and Paddle billing.',
};

export default function PrivacyRootPage() {
  return <LegalDocumentPage kind="privacy" locale="en" />;
}

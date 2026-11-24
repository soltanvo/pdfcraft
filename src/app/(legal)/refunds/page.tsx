import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';

export const metadata: Metadata = {
  title: 'Refund Policy | SA AI',
  description: '7-day monthly subscription Refund Policy for SA AI.',
};

export default function RefundsPage() {
  return <LegalDocumentPage kind="refunds" locale="en" />;
}

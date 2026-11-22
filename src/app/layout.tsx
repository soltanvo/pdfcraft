import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SA AI - منصة أدوات PDF والذكاء الاصطناعي الاحترافية',
  description:
    'منصة SA AI الشاملة لأدوات PDF الاحترافية ومساعد الذكاء الاصطناعي المتكامل.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

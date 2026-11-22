'use client';

import React from 'react';
import Link from 'next/link';
import { type Locale } from '@/lib/i18n/config';

export interface FooterProps {
  locale: Locale;
}

export const Footer: React.FC<FooterProps> = ({ locale }) => {
  return (
    <footer className="w-full border-t border-gray-200 bg-white pt-16 pb-8" role="contentinfo">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-6">
          <Link href={`/${locale}`} className="flex items-center gap-2" dir="ltr">
            <img src="/logo.png" alt="SA AI" className="h-12 w-12 rounded-xl object-contain shrink-0" />
            <div className="flex items-center gap-1 text-2xl font-bold tracking-tight whitespace-nowrap">
              <span className="text-blue-900">SA</span>
              <span className="text-amber-500 font-bold">|</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600 drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]">AI</span>
            </div>
          </Link>
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} SA AI. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

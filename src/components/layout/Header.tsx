import React from "react";
import Link from "next/link";
import { type Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/Button";

export interface HeaderProps {
  locale: Locale;
}

export const Header: React.FC<HeaderProps> = ({ locale }) => {
  const navItems = [
    { href: `/${locale}`, label: "الرئيسية" },
    { href: `/${locale}/tools`, label: "الأدوات" },
    { href: `/${locale}/ai-tools`, label: "الذكاء الاصطناعي" },
    { href: `/${locale}/pricing`, label: "الباقات" },
    { href: `/${locale}/about`, label: "من نحن" },
  ];

  return (
    <header className="fixed top-0 z-50 w-full h-16 bg-white border-b border-gray-200" role="banner">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={`/${locale}`} className="flex items-center gap-2" dir="ltr">
            <img src="/logo.png" alt="SA AI" className="h-12 w-12 rounded-xl object-contain shrink-0" />
            <div className="flex items-center gap-1 text-2xl font-bold tracking-tight whitespace-nowrap">
              <span className="text-blue-900">SA</span>
              <span className="text-amber-500 font-bold">|</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600 drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]">AI</span>
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 whitespace-nowrap">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium text-gray-600 hover:text-blue-900 transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-gray-700">الرصيد: 0</span>
          <Button variant="outline" size="sm" className="whitespace-nowrap">
            تسجيل الدخول
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;

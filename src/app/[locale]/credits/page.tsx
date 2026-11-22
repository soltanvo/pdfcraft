'use client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useParams } from 'next/navigation';
import { type Locale } from '@/lib/i18n/config';

export default function CreditsPage() {
  const params = useParams();
  const locale = (params.locale as Locale) || 'en';

  const handleCheckout = (amount: number, points: number) => {
    alert(`بدء عملية الدفع بقيمة $${amount} للحصول على ${points} نقطة.`);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header locale={locale} />
      <main className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-8">شحن الرصيد</h1>
        <div className="flex gap-4 justify-center">
          <div className="p-6 bg-white rounded shadow-md"><h2 className="text-xl">باقة أساسية</h2><p>2$ - 30 نقطة</p><Button onClick={() => handleCheckout(2, 30)}>شراء</Button></div>
          <div className="p-6 bg-white rounded shadow-md"><h2 className="text-xl">باقة محترفة</h2><p>5$ - 100 نقطة</p><Button onClick={() => handleCheckout(5, 100)}>شراء</Button></div>
        </div>
      </main>
      <Footer locale={locale} />
    </div>
  );
}

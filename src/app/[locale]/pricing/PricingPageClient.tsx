'use client';

import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { type Locale } from '@/lib/i18n/config';

interface PricingPageClientProps {
  locale: Locale;
}

export default function PricingPageClient({ locale }: PricingPageClientProps) {
  const plans = [
    { 
        name: 'الباقة المجانية', 
        price: 0, 
        points: 5, 
        features: ['5 نقاط مجانية عند التسجيل', '130+ أداة PDF', 'علامة SA AI المائية']
    },
    { 
        name: 'باقة البداية', 
        price: 2, 
        points: 30, 
        features: ['30 نقطة', 'إزالة العلامة المائية تلقائياً', 'جميع أدوات الذكاء الاصطناعي', 'رفع الصور والملفات'] 
    },
    { 
        name: 'باقة المحترفين', 
        price: 5, 
        points: 100, 
        features: ['100 نقطة', 'إزالة العلامة المائية تلقائياً', 'استخدام غير محدود للذكاء الاصطناعي والـ PDF', 'أولوية قصوى'], 
        popular: true 
    },
  ];

  const paypalOptions: any = {
    "client-id": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "test",
    currency: "USD",
  };

  return (
    <PayPalScriptProvider options={paypalOptions}>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Header locale={locale} />
        <main className="container mx-auto px-4 pt-32 pb-20">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-blue-900 mb-4">اختر خطتك المثالية</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <div key={index} className={`relative p-8 rounded-3xl bg-white shadow-xl ${plan.popular ? 'ring-2 ring-amber-500' : ''}`}>
                <h3 className="text-2xl font-bold mb-4">{plan.name}</h3>
                <div className="text-4xl font-bold mb-6 text-blue-900">$ {plan.price}</div>
                <ul className="space-y-3 mb-8">
                    {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-gray-700">✓ {f}</li>
                    ))}
                </ul>
                
                {plan.price > 0 ? (
                  <PayPalButtons
                    createOrder={(data, actions) => {
                      return actions.order.create({
                        intent: "CAPTURE",
                        purchase_units: [{ amount: { currency_code: 'USD', value: plan.price.toString() } }],
                      });
                    }}
                    onApprove={async (data, actions) => {
                      const order = await actions.order?.capture();
                      // TODO: API call to add points to Firestore
                      alert(`تم الدفع بنجاح! تم إضافة ${plan.points} نقطة لرصيدك.`);
                    }}
                  />
                ) : (
                  <button className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl">ابدأ مجاناً</button>
                )}
              </div>
            ))}
          </div>
        </main>
        <Footer locale={locale} />
      </div>
    </PayPalScriptProvider>
  );
}

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
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const plans = [
    { name: 'الباقة المجانية', price: 0, points: 0 },
    { name: 'باقة البداية', price: 2, points: 30, description: '30 نقطة فورية' },
    { name: 'باقة المحترفين', price: 5, points: 100, description: '100 نقطة فورية', popular: true },
  ];

  const paypalOptions: any = {
    "client-id": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
    currency: "USD",
  };

  return (
    <PayPalScriptProvider options={paypalOptions}>
      <div className="min-h-screen bg-[#0a0f1e] text-white">
        <Header locale={locale} />
        <main className="container mx-auto px-4 pt-32 pb-20">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent mb-4">
              اختر خطتك المثالية
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <div key={index} className={`relative p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl ${plan.popular ? 'ring-2 ring-yellow-500' : ''}`}>
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="text-4xl font-bold mb-4 text-yellow-400">${plan.price}</div>
                
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
                      console.log("Order captured:", order);
                      // TODO: Add points to Firestore here
                      alert(`تم شراء ${plan.name} بنجاح!`);
                    }}
                  />
                ) : (
                  <button className="w-full bg-gray-600 text-white font-bold py-3 rounded-xl cursor-not-allowed">ابدأ الآن</button>
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


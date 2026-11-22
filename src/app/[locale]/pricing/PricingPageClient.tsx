'use client';

import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { type Locale } from '@/lib/i18n/config';

export default function PricingPageClient({ locale }: { locale: Locale }) {
  return (
    <PayPalScriptProvider options={{ "client-id": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "sb", currency: "USD" }}>
      <div className="min-h-screen bg-gray-50">
        <Header locale={locale} />
        <div className="pt-24 container mx-auto p-4 flex gap-8 justify-center">
            {/* Starter */}
            <div className="p-8 bg-white rounded-xl shadow-lg w-80">
                <h2 className="text-xl font-bold mb-4">باقة البداية ()</h2>
                <PayPalButtons createOrder={(data, actions) => actions.order.create({ intent: "CAPTURE", purchase_units: [{ amount: { value: '2.00' } }] })} />
            </div>
            {/* Pro */}
            <div className="p-8 bg-white rounded-xl shadow-lg w-80">
                <h2 className="text-xl font-bold mb-4">باقة المحترفين ()</h2>
                <PayPalButtons createOrder={(data, actions) => actions.order.create({ intent: "CAPTURE", purchase_units: [{ amount: { value: '5.00' } }] })} />
            </div>
        </div>
        <Footer locale={locale} />
      </div>
    </PayPalScriptProvider>
  );
}

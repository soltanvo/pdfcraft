'use client';

import { type Locale } from '@/lib/i18n/config';
import React, { useState } from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';

export default function AIToolsClient({ locale }: { locale: string }) {
  const { user, signInWithGoogle, deductCredits } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'translate' | 'excel' | 'summarize'>('chat');
  const [chatQuery, setChatQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleSend = async () => {
    if (!user) {
        signInWithGoogle();
        return;
    }
    
    setIsLoading(true);
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsLoading(false);
    alert("تم معالجة الطلب");
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header locale={locale as Locale} />
      <main className="container mx-auto p-4 pt-24">
        <div className={`max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-xl border-2 transition-all duration-300 ${isLoading ? 'border-transparent bg-gradient-to-r from-amber-400 to-blue-500 p-[2px]' : 'border-gray-200'}`}>
          <div className={`bg-white rounded-xl p-6 ${isLoading ? 'h-full' : ''}`}>
             <h1 className="text-2xl font-bold mb-6 text-center">أدوات الذكاء الاصطناعي</h1>
             <div className="flex gap-2 justify-center mb-6 flex-wrap">
                {['chat', 'translate', 'excel', 'summarize'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-full ${activeTab === tab ? 'bg-blue-900 text-white' : 'bg-gray-200'}`}>
                        {tab === 'chat' ? 'دردشة ذكية' : tab === 'translate' ? 'ترجمة احترافية' : tab === 'excel' ? 'استخراج Excel' : 'تلخيص ملفات'}
                    </button>
                ))}
             </div>
             
             <div className="flex gap-2 items-center">
                 <input type="text" value={chatQuery} onChange={e => setChatQuery(e.target.value)} className="flex-1 p-3 border rounded-lg" placeholder="اسأل أي شيء..." />
                 <label className="cursor-pointer text-xl">📎
                    <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                 </label>
                 <Button onClick={handleSend} disabled={isLoading}>إرسال</Button>
             </div>
             {file && <div className="mt-2 text-sm text-blue-600">ملف مرفق: {file.name}</div>}
          </div>
        </div>
      </main>
      <Footer locale={locale as Locale} />
    </div>
  );
}

'use client';

import { type Locale } from '@/lib/i18n/config';
import React, { useState } from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { MessageSquare, Languages, FileSpreadsheet } from 'lucide-react';

export default function AIToolsClient({ locale }: { locale: string }) {
  const { deductCredits } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'translate' | 'excel'>('chat');
  const [modelType, setModelType] = useState<'fast' | 'pro'>('fast');
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [translatedResult, setTranslatedResult] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const cost = modelType === 'fast' ? 1 : 3;

  const handleOpenRouterAI = async (prompt: string) => {
    const success = await deductCredits(cost);
    if (!success) { alert("رصيد غير كافٍ"); return null; }

    const selectedModel = modelType === 'fast' ? 'google/gemini-2.5-flash' : 'anthropic/claude-3.5-sonnet';

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, messages: [{ role: "user", content: prompt }] })
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "خطأ.";
    } catch (e) { return "خطأ في الاتصال."; }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir="rtl">
      <Header locale={locale as Locale} />
      <main className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6 text-center">أدوات SA AI</h1>
        <div className="flex gap-4 justify-center mb-8">
          <Button onClick={() => setActiveTab('chat')}>دردشة</Button>
          <Button onClick={() => setActiveTab('translate')}>ترجمة</Button>
          <Button onClick={() => setActiveTab('excel')}>جداول Excel</Button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex gap-4 mb-4">
            <label><input type="radio" checked={modelType === 'fast'} onChange={() => setModelType('fast')} /> سريع (نقطة واحدة)</label>
            <label><input type="radio" checked={modelType === 'pro'} onChange={() => setModelType('pro')} /> احترافي (3 نقاط)</label>
          </div>
          {activeTab === 'chat' && (
            <div className="space-y-4">
              <input type="text" value={chatQuery} onChange={e => setChatQuery(e.target.value)} className="w-full p-2 border" placeholder="سؤال..." />
              <Button onClick={async () => {
                setIsChatting(true);
                const res = await handleOpenRouterAI(chatQuery);
                setChatMessages([...chatMessages, { role: 'user', text: chatQuery }, { role: 'assistant', text: res || '' }]);
                setIsChatting(false);
              }}>إرسال</Button>
            </div>
          )}
        </div>
      </main>
      <Footer locale={locale as Locale} />
    </div>
  );
}

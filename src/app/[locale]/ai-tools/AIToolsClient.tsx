'use client';

import { type Locale } from '@/lib/i18n/config';
import React, { useState } from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Plus, Send, FileText, Image as ImageIcon } from 'lucide-react';

export default function AIToolsClient({ locale }: { locale: string }) {
  const { user, signInWithGoogle } = useAuth();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleSend = async () => {
    if (!user) { signInWithGoogle(); return; }
    if (!input.trim() && !file) return;

    setIsLoading(true);
    // Call /api/ai here
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setInput('');
    setFile(null);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setMessages(prev => [...prev, { role: 'assistant', text: "هذا رد تجريبي من SA AI" }]);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header locale={locale as Locale} />
      <div className="flex-1 flex pt-16">
        {/* Left Chat Sidebar */}
        <div className={`w-full lg:w-[420px] h-[calc(100vh-4rem)] border-r flex flex-col bg-white relative ${isLoading ? 'p-[2px] bg-gradient-to-r from-amber-400 to-blue-500' : ''}`}>
          <div className="flex-1 bg-white p-4 overflow-y-auto">
             {messages.map((m, i) => <div key={i} className="mb-2 p-2 bg-gray-100 rounded">{m.text}</div>)}
          </div>
          <div className="p-4 border-t bg-white">
            <div className="flex items-center gap-2">
                <label className="p-2 bg-gray-200 rounded-full cursor-pointer"><Plus size={20} /></label>
                <input value={input} onChange={e => setInput(e.target.value)} className="flex-1 p-2 border rounded" placeholder="اسأل..." />
                <Button onClick={handleSend}><Send size={20} /></Button>
            </div>
          </div>
        </div>
        {/* Main Content Area */}
        <div className="flex-1 bg-gray-50 p-8">
            <h1 className="text-2xl font-bold">مساحة المعاينة والنتائج</h1>
        </div>
      </div>
    </div>
  );
}

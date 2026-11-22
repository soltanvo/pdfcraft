'use client';
import { useState, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Plus, Send } from 'lucide-react';

export default function AIToolsClient({ locale }: { locale: string }) {
  const [messages, setMessages] = useState<{ role: string, content: any }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMessages(prev => [...prev, { role: 'user', content: [{ type: 'text', text: 'صورة مرفقة: ' + file.name }, { type: 'image_url', image_url: { url: reader.result } }] }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    const newMsg = { role: 'user', content: input };
    const updatedMessages = [...messages, { role: 'user', content: input }];
    setMessages(updatedMessages);
    setInput('');

    const res = await fetch('/api/ai', {
      method: 'POST',
      body: JSON.stringify({ messages: updatedMessages }),
    });
    const data = await res.json();
    setMessages(prev => [...prev, { role: 'assistant', content: data.choices[0].message.content }]);
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen overflow-hidden" dir="ltr">
        <div className="w-[420px] border-r flex flex-col bg-white h-full" style={{ border: isLoading ? '2px solid gold' : '1px solid #ccc' }}>
            <div className="flex-1 overflow-y-auto p-4" dir="rtl">
                {messages.map((m, i) => <div key={i} className="mb-4">{typeof m.content === 'string' ? m.content : 'صورة/ملف'}</div>)}
            </div>
            <div className="p-4 border-t" dir="rtl">
                <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 border rounded"><Plus /></button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                    <input value={input} onChange={e => setInput(e.target.value)} className="flex-1 border p-2 rounded" placeholder="اسأل..." />
                    <Button onClick={handleSend} disabled={isLoading}><Send /></Button>
                </div>
            </div>
        </div>
        <div className="flex-1 bg-gray-100 p-8">معاينة النتائج هنا</div>
    </div>
  );
}

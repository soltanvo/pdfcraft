'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Coins,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { extractPdfTextByPage, renderPdfPageToCanvas } from '@/lib/pdf/pdfjs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface AttachedFile {
  name: string;
  kind: 'image' | 'pdf' | 'txt';
  size: number;
  imageDataUrl?: string;
  previewImageUrl?: string;
  documentText?: string;
  pageCount?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
  attachmentPreviewUrl?: string;
  timestamp: string;
}

interface ActionLinkItem {
  label: string;
  href: string;
}

function isSafeInternalRoute(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//') && !/\s/.test(href);
}

function isSafeExternalUrl(href: string): boolean {
  return /^https?:\/\//i.test(href) || /^mailto:/i.test(href);
}

function extractInternalActionLinks(content: string): ActionLinkItem[] {
  const seen = new Set<string>();
  const results: ActionLinkItem[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(content)) !== null) {
    const label = match[1].trim();
    const href = match[2].trim();
    if (label && isSafeInternalRoute(href) && !seen.has(href)) {
      seen.add(href);
      results.push({ label, href });
    }
  }
  return results;
}

function renderInlineMarkdown(text: string, standaloneLink = false): React.ReactNode[] {
  const tokenRegex = /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (linkMatch) {
      const label = linkMatch[1].trim();
      const href = linkMatch[2].trim();
      if (isSafeInternalRoute(href)) {
        return (
          <Link
            key={idx}
            href={href}
            className={
              standaloneLink
                ? 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-sm font-semibold shadow-xs transition-colors no-underline'
                : 'inline-flex items-center gap-1 px-2.5 py-0.5 mx-0.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors align-baseline no-underline'
            }
          >
            <span>{label}</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
        );
      }
      if (isSafeExternalUrl(href)) {
        return (
          <a
            key={idx}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 underline font-semibold"
          >
            <span>{label}</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
        );
      }
      return <span key={idx}>{label}</span>;
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          dir="ltr"
          className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={idx}>{part}</span>;
  });
}

function SafeMarkdownView({ content }: { content: string }) {
  const blocks = content.split(/```[\s\S]*?```/g);
  const codeMatches = content.match(/```[\s\S]*?```/g) || [];

  return (
    <div className="space-y-4 text-base font-medium leading-8 text-slate-800">
      {blocks.map((block, bIdx) => (
        <div key={bIdx} className="space-y-3">
          {block
            .split('\n')
            .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
            .map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="text-lg font-bold text-slate-900 pt-2">
                    {renderInlineMarkdown(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="text-xl font-bold text-slate-900 pt-2">
                    {renderInlineMarkdown(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={lIdx} className="text-2xl font-extrabold text-slate-900 pt-2">
                    {renderInlineMarkdown(trimmed.slice(2))}
                  </h2>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const body = trimmed.slice(2);
                const isOnlyLink = /^\[[^\]]+\]\([^)\s]+\)$/.test(body.trim());
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 ps-2">
                    <span className="text-amber-600 font-bold mt-0.5">•</span>
                    <div className="flex-1">{renderInlineMarkdown(body, isOnlyLink)}</div>
                  </div>
                );
              }
              const orderedMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
              if (orderedMatch) {
                const isOnlyLink = /^\[[^\]]+\]\([^)\s]+\)$/.test(orderedMatch[2].trim());
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 ps-2">
                    <span className="text-slate-700 font-bold tabular-nums">{orderedMatch[1]}</span>
                    <div className="flex-1">{renderInlineMarkdown(orderedMatch[2], isOnlyLink)}</div>
                  </div>
                );
              }
              const isStandaloneLink = /^\[[^\]]+\]\([^)\s]+\)$/.test(trimmed);
              if (isStandaloneLink) {
                return (
                  <div key={lIdx} className="pt-1">
                    {renderInlineMarkdown(trimmed, true)}
                  </div>
                );
              }
              return (
                <p key={lIdx} className="whitespace-pre-wrap">
                  {renderInlineMarkdown(trimmed)}
                </p>
              );
            })}

          {codeMatches[bIdx] && (
            <pre
              dir="ltr"
              className="rounded-xl bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto"
            >
              <code>{codeMatches[bIdx].replace(/^```[a-zA-Z]*\n?|```$/g, '')}</code>
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

export function AIToolsClient({ locale }: { locale: string }) {
  const isArabic = locale === 'ar';
  const contentDir = locale === 'ar' || locale === 'he' ? 'rtl' : 'ltr';
  const { user, credits, isPaid, signInWithGoogle, deductCredit } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attached, setAttached] = useState<AttachedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractingFile, setExtractingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const assistantResults = messages.filter((m) => m.role === 'assistant');
  const activeResult =
    assistantResults.find((m) => m.id === activeResultId) ||
    assistantResults[assistantResults.length - 1] ||
    null;

  const quickPrompts = isArabic
    ? [
        'لخّص هذا المستند في نقاط رئيسية واضحة',
        'أنشئ اختباراً (أسئلة اختيار من متعدد مع الإجابات) من المحتوى',
        'كيف أدمج أو أضغط ملفات PDF في المنصة؟',
        'استخرج البيانات والأسماء والأرقام المهمة من الملف',
      ]
    : [
        'Summarize this document into clear key points',
        'Create an exam / quiz with multiple-choice questions and answers',
        'How do I merge or compress PDF files on SA AI?',
        'Extract key entities, dates, and figures from this file',
      ];

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setExtractingFile(true);

    try {
      const lower = file.name.toLowerCase();
      if (
        file.type.startsWith('image/') ||
        /\.(jpe?g|png|webp)$/i.test(lower)
      ) {
        if (file.size > 8 * 1024 * 1024) {
          throw new Error(isArabic ? 'حجم الصورة يتجاوز 8 ميجابايت.' : 'Image exceeds 8 MB limit.');
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read image'));
          reader.readAsDataURL(file);
        });
        setAttached({
          name: file.name,
          kind: 'image',
          size: file.size,
          imageDataUrl: dataUrl,
          previewImageUrl: dataUrl,
        });
      } else if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pages = await extractPdfTextByPage(bytes);
        const text = pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');
        let previewUrl: string | undefined;
        try {
          const canvas = await renderPdfPageToCanvas(bytes, 1, 0.9);
          previewUrl = canvas.toDataURL('image/png');
        } catch {
          // Optional thumbnail
        }
        setAttached({
          name: file.name,
          kind: 'pdf',
          size: file.size,
          documentText: text.trim() || `[PDF uploaded: ${file.name}, ${pages.length} pages]`,
          previewImageUrl: previewUrl,
          imageDataUrl: !text.trim() && previewUrl ? previewUrl : undefined,
          pageCount: pages.length,
        });
      } else if (file.type === 'text/plain' || lower.endsWith('.txt')) {
        const text = await file.text();
        setAttached({
          name: file.name,
          kind: 'txt',
          size: file.size,
          documentText: text.slice(0, 45000),
        });
      } else {
        throw new Error(
          isArabic
            ? 'نوع الملف غير مدعوم. يرجى رفع JPG أو PNG أو WebP أو PDF أو TXT.'
            : 'Unsupported file type. Upload JPG, PNG, WebP, PDF, or TXT.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read attached file.');
    } finally {
      setExtractingFile(false);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const promptText = (customPrompt ?? input).trim();
    if (!promptText && !attached) return;

    if (!user) {
      await signInWithGoogle();
      return;
    }

    if (credits < 1) {
      setError(
        isArabic
          ? 'نفد رصيد النقاط لديك. يرجى شحن رصيدك من صفحة الباقات للمتابعة.'
          : 'You have 0 credits remaining. Please top up in Pricing to continue.'
      );
      return;
    }

    setError(null);
    const currentAttached = attached;
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: promptText || (currentAttached ? `Analyze ${currentAttached.name}` : ''),
      attachmentName: currentAttached?.name,
      attachmentPreviewUrl: currentAttached?.previewImageUrl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setAttached(null);
    setIsLoading(true);

    const assistantId = `a_${Date.now()}`;
    const assistantTimestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg.content,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          imageDataUrl: currentAttached?.imageDataUrl || null,
          documentText: currentAttached?.documentText || null,
          fileName: currentAttached?.name || null,
          locale,
        }),
      });

      if (!res.ok) {
        let errMsg = `AI service error (${res.status})`;
        try {
          const errData = (await res.json()) as { error?: string };
          if (errData?.error) errMsg = errData.error;
        } catch {
          // Ignore parse error
        }
        throw new Error(errMsg);
      }

      const contentType = res.headers.get('content-type') || '';
      let fullReply = '';
      let streamError: string | null = null;

      if (contentType.includes('text/event-stream') && res.body) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: assistantTimestamp,
          },
        ]);
        setActiveResultId(assistantId);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        const applyChunkText = (chunkText: string) => {
          fullReply += chunkText;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullReply } : m))
          );
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });

          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr) as {
                text?: string;
                error?: string;
                done?: boolean;
              };
              if (parsed.error) {
                streamError = parsed.error;
              } else if (parsed.text) {
                applyChunkText(parsed.text);
              }
            } catch {
              // Ignore partial SSE JSON
            }
          }
        }

        const trailing = sseBuffer.trim();
        if (trailing.startsWith('data:')) {
          try {
            const parsed = JSON.parse(trailing.slice(5).trim()) as {
              text?: string;
              error?: string;
            };
            if (parsed.error) streamError = parsed.error;
            else if (parsed.text) applyChunkText(parsed.text);
          } catch {
            // Ignore trailing parse error
          }
        }

        if (streamError && !fullReply.trim()) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          throw new Error(streamError);
        }

        if (!fullReply.trim()) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          throw new Error('Empty response from AI model.');
        }
      } else {
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!data.reply) {
          throw new Error(data.error || 'AI request failed');
        }
        fullReply = data.reply;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: fullReply,
            timestamp: assistantTimestamp,
          },
        ]);
        setActiveResultId(assistantId);
      }

      await deductCredit();
      if (streamError) {
        setError(streamError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI response.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!activeResult) return;
    await navigator.clipboard.writeText(activeResult.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExportPdf = async () => {
    if (!activeResult) return;
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 48;
    const maxLineWidth = pageWidth - margin * 2;

    const cleanAscii = activeResult.content.replace(/[^\x20-\x7E\n]/g, ' ');
    const rawLines = cleanAscii.split('\n');
    const wrapped: string[] = [];
    for (const raw of rawLines) {
      const words = raw.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        wrapped.push('');
        continue;
      }
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, 11) > maxLineWidth && current) {
          wrapped.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) wrapped.push(current);
    }

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    page.drawText('SA AI - Analysis Export', {
      x: margin,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0.06, 0.09, 0.16),
    });
    y -= 28;

    for (const line of wrapped) {
      if (y < margin + 30) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      if (line) {
        page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.12, 0.16, 0.24) });
      }
      y -= 16;
    }

    if (!isPaid) {
      for (const p of pdfDoc.getPages()) {
        const { width } = p.getSize();
        const wm = 'SA AI';
        const w = boldFont.widthOfTextAtSize(wm, 9);
        p.drawText(wm, {
          x: width / 2 - w / 2,
          y: 14,
          size: 9,
          font: boldFont,
          color: rgb(0.45, 0.5, 0.58),
          opacity: 0.4,
        });
      }
    }

    const bytes = await pdfDoc.save();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sa-ai-analysis-${Date.now()}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div dir="ltr" className="flex flex-col md:flex-row w-full bg-white min-h-[calc(100vh-4rem)]">
      {/* Left Physical Bolt.new-style Chat Column */}
      <aside
        dir={contentDir}
        className="h-[calc(100vh-4rem)] w-full md:w-[380px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col bg-white"
      >
        {/* Chat Column Top Bar */}
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <h1 className="font-bold text-base text-slate-900 truncate">
              {isArabic ? 'مساعد SA AI الذكي' : 'SA AI Studio'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <Link
                href={`/${locale}/pricing`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md tabular-nums hover:bg-amber-100"
              >
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                <span>{credits}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
              >
                {isArabic ? 'تسجيل الدخول' : 'Sign In'}
              </button>
            )}

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setActiveResultId(null);
                  setError(null);
                }}
                title={isArabic ? 'محادثة جديدة' : 'Clear chat'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Chat Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-5 pt-2">
              <div className="rounded-xl border border-slate-200 bg-gray-50 p-4 space-y-2">
                <p className="text-base font-bold text-slate-900">
                  {isArabic
                    ? 'مرحباً بك في استوديو SA AI'
                    : 'Welcome to SA AI Studio'}
                </p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                  {isArabic
                    ? 'ارفع صورة (JPG, PNG, WebP) أو مستند (PDF, TXT) عبر زر + في الأسفل، أو اسأل عن أي أداة PDF وسيوجهك المساعد مباشرة إليها بسرعة فائقة بنموذج Gemini 2.5 Flash (نقطة واحدة لكل رسالة).'
                    : 'Attach an image (JPG, PNG, WebP) or document (PDF, TXT) via the + button below, or ask how to use any SA AI tool for instant guidance powered by Gemini 2.5 Flash (1 credit per response).'}
                </p>
              </div>

              <div className="space-y-2.5">
                <p className="text-base font-bold text-slate-700">
                  {isArabic ? 'أوامر سريعة:' : 'Quick prompts:'}
                </p>
                <div className="grid grid-cols-1 gap-2.5">
                  {quickPrompts.map((qp) => (
                    <button
                      key={qp}
                      type="button"
                      onClick={() => void handleSend(qp)}
                      className="text-start px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/40 text-base font-medium leading-relaxed text-slate-800 transition-colors cursor-pointer"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                onClick={() => {
                  if (m.role === 'assistant') setActiveResultId(m.id);
                }}
                className={`rounded-xl p-4 text-base font-medium leading-relaxed border transition-colors ${
                  m.role === 'user'
                    ? 'bg-slate-900 text-white border-slate-900 ms-4'
                    : activeResult?.id === m.id
                    ? 'bg-amber-50/60 text-slate-900 border-amber-300 me-3 cursor-pointer'
                    : 'bg-gray-50 text-slate-900 border-slate-200 me-3 cursor-pointer hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 opacity-75 text-xs font-semibold">
                  <span>{m.role === 'user' ? (isArabic ? 'أنت' : 'You') : 'SA AI'}</span>
                  <span className="tabular-nums">{m.timestamp}</span>
                </div>
                {m.attachmentName && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{m.attachmentName}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap line-clamp-6">
                  {m.content
                    ? m.content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '')
                    : isArabic
                    ? 'جارٍ الكتابة...'
                    : 'Streaming...'}
                </p>
                {m.role === 'assistant' && (() => {
                  const actionLinks = extractInternalActionLinks(m.content);
                  if (actionLinks.length === 0) return null;
                  return (
                    <div
                      className="mt-2.5 flex flex-wrap gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actionLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                        >
                          <span>{item.label}</span>
                          <ArrowUpRight className="w-3 h-3 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 text-blue-800 text-base font-medium">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span>{isArabic ? 'SA AI يكتب الإجابة مباشرة...' : 'SA AI is streaming response...'}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>{error}</p>
                {credits < 1 && user && (
                  <Link
                    href={`/${locale}/pricing`}
                    className="inline-block font-bold text-rose-900 underline"
                  >
                    {isArabic ? 'انتقل إلى الباقات لشحن النقاط' : 'Go to Pricing to top up'}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Composer with Animated Conic-Gradient Glowing Border on Loading */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <div
            className={
              isLoading
                ? 'sa-glow-border-shell shadow-lg'
                : 'rounded-2xl border border-slate-200 bg-white p-0.5 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20'
            }
          >
            {isLoading && <div className="sa-glow-border-spinner" aria-hidden="true" />}

            <div className="relative z-10 rounded-[14px] bg-white p-2.5 space-y-2">
              {/* Thumbnail / File Preview Before Send */}
              {attached && (
                <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-gray-50 border border-slate-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {attached.previewImageUrl ? (
                      <img
                        src={attached.previewImageUrl}
                        alt={attached.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {attached.name}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {(attached.size / 1024).toFixed(1)} KB
                        {attached.pageCount ? ` · ${attached.pageCount} pages` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttached(null)}
                    aria-label="Remove attachment"
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.pdf,.txt,application/pdf,text/plain"
                  onChange={(e) => void handleFilePick(e)}
                  className="hidden"
                />

                {/* Circular + Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extractingFile || isLoading}
                  title={
                    isArabic
                      ? 'رفع صورة (JPG, PNG, WebP) أو ملف (PDF, TXT)'
                      : 'Upload image (JPG, PNG, WebP) or file (PDF, TXT)'
                  }
                  className="w-10 h-10 rounded-full border border-slate-200 bg-gray-50 hover:bg-slate-100 hover:border-blue-400 text-slate-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {extractingFile ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </button>

                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={
                    isArabic
                      ? 'اسأل SA AI أو اطلب تحليل الملف المرفق...'
                      : 'Ask SA AI or analyze an attached file...'
                  }
                  className="flex-1 resize-none border-0 bg-transparent px-2 py-2 text-base font-medium leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isLoading || (!input.trim() && !attached)}
                  className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  aria-label="Send"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Wide Preview & AI Results Canvas */}
      <section
        dir={contentDir}
        className="flex-1 h-[calc(100vh-4rem)] overflow-y-auto bg-gray-50 p-6 sm:p-8"
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Attached File Live Preview Card */}
          {attached && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  {attached.kind === 'image' ? (
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                  ) : (
                    <FileText className="w-4 h-4 text-amber-600" />
                  )}
                  <span>
                    {isArabic ? `معاينة الملف: ${attached.name}` : `File Preview: ${attached.name}`}
                  </span>
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  {(attached.size / 1024).toFixed(1)} KB
                </span>
              </div>

              {attached.previewImageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-gray-50 max-h-72 flex items-center justify-center p-2">
                  <img
                    src={attached.previewImageUrl}
                    alt={attached.name}
                    referrerPolicy="no-referrer"
                    className="max-h-64 w-auto object-contain rounded-lg"
                  />
                </div>
              )}

              {attached.documentText && (
                <div className="rounded-xl border border-slate-200 bg-gray-50 p-3.5 max-h-44 overflow-y-auto text-xs text-slate-700 whitespace-pre-wrap font-mono">
                  {attached.documentText.slice(0, 1800)}
                  {attached.documentText.length > 1800 ? '\n...' : ''}
                </div>
              )}
            </div>
          )}

          {/* Main AI Result Panel */}
          {activeResult ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h2 className="font-bold text-base text-slate-900">
                    {isArabic ? 'النتائج والمعاينة' : 'AI Analysis & Result'}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied ? (isArabic ? 'تم النسخ' : 'Copied') : isArabic ? 'نسخ' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleExportPdf()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'تصدير PDF' : 'Export PDF'}</span>
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                {activeResult.content ? (
                  <SafeMarkdownView content={activeResult.content} />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>{isArabic ? 'جارٍ استقبال الرد...' : 'Receiving streamed response...'}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 text-amber-500" />
              </div>
              <div className="max-w-lg mx-auto space-y-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {isArabic
                    ? 'مساحة عرض النتائج والمعاينة'
                    : 'AI Preview & Results Workspace'}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {isArabic
                    ? 'ستظهر هنا معاينة الصور وملفات PDF المرفقة ونتائج التحليل والاختبارات وروابط الأدوات الفورية من Gemini 2.5 Flash مع إمكانية النسخ أو التصدير المباشر.'
                    : 'Attached images, PDF previews, structured analysis, exams, and direct tool action links from Gemini 2.5 Flash stream here live ready to copy or export.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default AIToolsClient;

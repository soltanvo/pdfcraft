'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUp,
  ArrowUpRight,
  Check,
  Coins,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { UpgradeCreditsModal } from '@/components/UpgradeCreditsModal';
import { db } from '@/lib/firebase/config';
import { extractPdfTextByPage, renderPdfPageToCanvas } from '@/lib/pdf/pdfjs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

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
        <strong key={idx} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          dir="ltr"
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-mono"
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
    <div className="space-y-4 text-base font-medium leading-8 text-slate-800 dark:text-slate-200">
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
                  <h4
                    key={lIdx}
                    className="text-lg font-bold text-slate-900 dark:text-white mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 first:mt-0 first:pt-0 first:border-t-0"
                  >
                    {renderInlineMarkdown(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3
                    key={lIdx}
                    className="text-xl font-extrabold text-slate-900 dark:text-white mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 first:mt-0 first:pt-0 first:border-t-0"
                  >
                    {renderInlineMarkdown(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={lIdx} className="text-2xl font-extrabold text-slate-900 dark:text-white pt-1">
                    {renderInlineMarkdown(trimmed.slice(2))}
                  </h2>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const body = trimmed.slice(2);
                const isOnlyLink = /^\[[^\]]+\]\([^)\s]+\)$/.test(body.trim());
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 ps-3">
                    <span className="text-amber-600 dark:text-amber-400 font-bold mt-0.5">•</span>
                    <div className="flex-1">{renderInlineMarkdown(body, isOnlyLink)}</div>
                  </div>
                );
              }
              const orderedMatch = trimmed.match(/^(\d+[.)])\s+(.*)$/);
              if (orderedMatch) {
                const isOnlyLink = /^\[[^\]]+\]\([^)\s]+\)$/.test(orderedMatch[2].trim());
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 ps-2 pt-1">
                    <span className="text-slate-900 dark:text-white font-bold tabular-nums shrink-0">
                      {orderedMatch[1]}
                    </span>
                    <div className="flex-1">{renderInlineMarkdown(orderedMatch[2], isOnlyLink)}</div>
                  </div>
                );
              }
              const optionMatch = trimmed.match(/^([أبجدهـA-Da-d][.)]|[(][أبجدهـA-Da-d][)])\s+(.*)$/);
              if (optionMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 ps-6 text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">
                      {optionMatch[1]}
                    </span>
                    <div className="flex-1">{renderInlineMarkdown(optionMatch[2])}</div>
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
              className="rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 text-slate-100 p-4 text-xs font-mono overflow-x-auto"
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
  const { user, profile, credits, firestoreOffline, isPaid, signInWithGoogle, deductCredit } =
    useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attached, setAttached] = useState<AttachedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractingFile, setExtractingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<'ar-SA' | 'en-US'>(isArabic ? 'ar-SA' : 'en-US');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeCreditInfo, setUpgradeCreditInfo] = useState<{
    available: number;
    required: 1 | 2;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceBaseInputRef = useRef('');
  const requiredCredits: 1 | 2 = attached ? 2 : 1;
  const hasInsufficientCredits = Boolean(user && profile && credits < requiredCredits);
  const canSend = Boolean(
    !isLoading && !extractingFile && (input.trim() || attached || hasInsufficientCredits)
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 152)}px`;
  }, [input]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore cleanup errors
      }
      recognitionRef.current = null;
    };
  }, []);

  const stopVoiceCapture = () => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // Ignore stop error
      }
    }
    setIsListening(false);
  };

  const handleToggleVoice = () => {
    if (isLoading) return;

    if (isListening) {
      stopVoiceCapture();
      return;
    }

    if (typeof window === 'undefined') return;
    const win = window as SpeechWindow;
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError(
        isArabic
          ? 'الإدخال الصوتي غير مدعوم في هذا المتصفح. يرجى استخدام Chrome أو Edge أو Safari الحديث.'
          : 'Voice input is not supported in this browser. Try Chrome, Edge, or modern Safari.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = speechLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      voiceBaseInputRef.current = input.trimEnd();

      recognition.onstart = () => {
        setError(null);
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const segments: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const piece = event.results[i]?.[0]?.transcript?.trim();
          if (piece) segments.push(piece);
        }
        const spoken = segments.join(' ').trim();
        const base = voiceBaseInputRef.current;
        const nextValue = base && spoken ? `${base} ${spoken}` : base || spoken;
        setInput(nextValue);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError(
            isArabic
              ? 'تم رفض إذن الميكروفون. يرجى تفعيل الميكروفون من إعدادات المتصفح.'
              : 'Microphone permission denied. Please allow microphone access in your browser settings.'
          );
        } else if (event.error === 'audio-capture') {
          setError(
            isArabic
              ? 'لم يتم العثور على ميكروفون متصل بجهازك.'
              : 'No microphone device was detected.'
          );
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError(
            isArabic
              ? 'تعذر إكمال الإدخال الصوتي. يرجى المحاولة مرة أخرى.'
              : 'Voice recognition could not complete. Please try again.'
          );
        }
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      setError(
        isArabic
          ? 'تعذر تشغيل الميكروفون في هذا المتصفح.'
          : 'Could not start microphone voice capture.'
      );
    }
  };

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
    if (isLoading) return;
    if (isListening) {
      stopVoiceCapture();
    }
    const promptText = (customPrompt ?? input).trim();
    if (!promptText && !attached) {
      if (hasInsufficientCredits) {
        setUpgradeCreditInfo({ available: credits, required: requiredCredits });
        setShowUpgradeModal(true);
      }
      return;
    }

    if (!user) {
      setError(
        isArabic
          ? 'يرجى تسجيل الدخول بحساب Google أولاً لاستخدام المساعد الذكي.'
          : 'Please sign in with Google first to use SA AI Studio.'
      );
      await signInWithGoogle();
      return;
    }

    const requestCost: 1 | 2 = attached ? 2 : 1;

    // Strictly verify live Firestore credit balance before sending (no free bypass)
    let availableCredits: number | null = profile ? profile.credits : null;
    if (availableCredits === null && db) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const remoteCredits = snap.data()?.credits;
          if (typeof remoteCredits === 'number') {
            availableCredits = remoteCredits;
          }
        }
      } catch (firestoreErr) {
        console.warn('Firestore credit verification failed:', firestoreErr);
      }
    }

    if (availableCredits === null) {
      setError(
        isArabic
          ? 'تعذر التحقق من رصيد النقاط حالياً من الخادم. يرجى التحقق من الاتصال وإعادة المحاولة.'
          : 'Could not verify your credit balance right now. Please check your connection and try again.'
      );
      return;
    }

    if (availableCredits < requestCost) {
      setUpgradeCreditInfo({ available: availableCredits, required: requestCost });
      setShowUpgradeModal(true);
      setError(
        isArabic
          ? availableCredits === 1 && requestCost === 2
            ? 'تحليل ملف PDF أو مرفق يتطلب نقطتين (2)، ورصيدك الحالي نقطة واحدة (1) فقط.'
            : 'انتهت نقاطك - اشحن رصيدك الآن للمتابعة.'
          : availableCredits === 1 && requestCost === 2
          ? 'Analyzing a PDF or attached file costs 2 credits, and you currently have 1 credit left.'
          : 'Out of credits — top up your balance now to continue.'
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

    let aiSucceeded = false;

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
        let streamDone = false;

        const applyChunkText = (chunkText: string) => {
          fullReply += chunkText;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullReply } : m))
          );
        };

        try {
          while (!streamDone) {
            const { value, done } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });

            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.slice(5).trim();
              if (!jsonStr) continue;
              if (jsonStr === '[DONE]') {
                streamDone = true;
                break;
              }
              try {
                const parsed = JSON.parse(jsonStr) as {
                  text?: string;
                  error?: string;
                  done?: boolean;
                };
                if (parsed.error) {
                  streamError = parsed.error;
                  streamDone = true;
                  break;
                }
                if (parsed.text) {
                  applyChunkText(parsed.text);
                }
                if (parsed.done) {
                  streamDone = true;
                  break;
                }
              } catch {
                // Ignore partial SSE JSON
              }
            }
          }
        } finally {
          if (streamDone) {
            void reader.cancel().catch(() => {});
          }
          try {
            reader.releaseLock();
          } catch {
            // Ignore if already released
          }
        }

        const trailing = sseBuffer.trim();
        if (!streamDone && trailing.startsWith('data:')) {
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

      aiSucceeded = true;
      if (streamError) {
        setError(streamError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI response.');
    } finally {
      setIsLoading(false);
    }

    if (aiSucceeded) {
      void deductCredit(requestCost).catch((deductErr) => {
        console.warn('Firestore credit deduction failed:', deductErr);
      });
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
    <div
      dir="ltr"
      className="flex flex-col md:flex-row w-full bg-white dark:bg-slate-950 min-h-[calc(100vh-4rem)]"
    >
      {/* Left Physical Chat Column */}
      <aside
        dir={contentDir}
        className="h-[calc(100vh-4rem)] w-full md:w-[380px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900"
      >
        {/* Chat Column Top Bar */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <h1 className="font-bold text-base text-slate-900 dark:text-white truncate">
              {isArabic ? 'مساعد SA AI الذكي' : 'SA AI Studio'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <Link
                href={`/${locale}/pricing`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-md tabular-nums hover:bg-amber-100 dark:hover:bg-amber-900/60"
              >
                <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{credits}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 p-4 space-y-2">
                <p className="text-base font-bold text-slate-900 dark:text-white">
                  {isArabic
                    ? 'مرحباً بك في استوديو SA AI'
                    : 'Welcome to SA AI Studio'}
                </p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  {isArabic
                    ? 'ارفع صورة (JPG, PNG, WebP) أو مستند (PDF, TXT) عبر زر + في الأسفل، أو اسأل عن أي أداة PDF وسيوجهك المساعد مباشرة إليها بسرعة فائقة بنموذج Gemini 2.5 Flash (1 نقطة للرسالة / 2 نقطة لتحليل PDF).'
                    : 'Attach an image (JPG, PNG, WebP) or document (PDF, TXT) via the + button below, or ask how to use any SA AI tool for instant guidance powered by Gemini 2.5 Flash (1 credit/msg, 2 credits/PDF).'}
                </p>
              </div>

              <div className="space-y-2.5">
                <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                  {isArabic ? 'أوامر سريعة:' : 'Quick prompts:'}
                </p>
                <div className="grid grid-cols-1 gap-2.5">
                  {quickPrompts.map((qp) => (
                    <button
                      key={qp}
                      type="button"
                      onClick={() => void handleSend(qp)}
                      className="text-start px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 text-base font-medium leading-relaxed text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
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
                    ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600 ms-4'
                    : activeResult?.id === m.id
                    ? 'bg-amber-50/60 dark:bg-amber-950/30 text-slate-900 dark:text-slate-100 border-amber-300 dark:border-amber-700 me-3 cursor-pointer'
                    : 'bg-gray-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 me-3 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600'
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
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="font-medium leading-relaxed">{error}</p>
                {hasInsufficientCredits && (
                  <Link
                    href={`/${locale}/pricing`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>
                      {isArabic
                        ? 'انتهت نقاطك - اشحن رصيدك الآن'
                        : 'Top up your credits now'}
                    </span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Google AI Studio-Style Composer with Animated Gradient Border */}
        <div className="px-3 pt-2.5 pb-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          {hasInsufficientCredits && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 text-xs">
              <span className="font-semibold">
                {isArabic
                  ? credits === 1 && requiredCredits === 2
                    ? 'تحليل PDF يتطلب نقطتين (رصيدك: 1)'
                    : 'انتهت نقاطك - اشحن رصيدك الآن'
                  : credits === 1 && requiredCredits === 2
                  ? 'PDF analysis requires 2 credits (Balance: 1)'
                  : 'Insufficient credits — top up to continue'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setUpgradeCreditInfo({ available: credits, required: requiredCredits });
                  setShowUpgradeModal(true);
                }}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>{isArabic ? 'اشحن الآن' : 'Upgrade'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div
            data-active={isLoading || isListening || Boolean(attached) ? 'true' : 'false'}
            data-loading={isLoading ? 'true' : 'false'}
            className="sa-ai-composer-shell"
          >
            <div className="sa-ai-composer-glow" aria-hidden="true" />

            <div className="relative z-10 rounded-[24px] bg-white dark:bg-slate-900 px-2.5 py-2 space-y-2">
              {/* Thumbnail / File Preview Before Send */}
              {attached && (
                <div className="flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {attached.previewImageUrl ? (
                      <img
                        src={attached.previewImageUrl}
                        alt={attached.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {attached.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {(attached.size / 1024).toFixed(1)} KB
                        {attached.pageCount ? ` · ${attached.pageCount} pages` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttached(null)}
                    aria-label="Remove attachment"
                    className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Google AI Studio Input Row: Left (+), Middle (Textarea), Right (Mic + ArrowUp Send) */}
              <form
                dir="ltr"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
                className="flex items-end gap-1.5"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.pdf,.txt,application/pdf,text/plain"
                  onChange={(e) => void handleFilePick(e)}
                  className="hidden"
                />

                {/* Left Side: Circular + Attach File Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extractingFile || isLoading}
                  title={
                    isArabic
                      ? 'إرفاق صورة (JPG, PNG, WebP) أو ملف (PDF, TXT)'
                      : 'Attach image (JPG, PNG, WebP) or file (PDF, TXT)'
                  }
                  aria-label={isArabic ? 'إرفاق ملف' : 'Attach file'}
                  className="w-10 h-10 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {extractingFile ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </button>

                {/* Center: Clean Expanding Textarea */}
                <textarea
                  ref={textareaRef}
                  dir={contentDir}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={
                    isListening
                      ? isArabic
                        ? `جارٍ الاستماع (${speechLang})... تكلّم الآن`
                        : `Listening (${speechLang})... speak now`
                      : isArabic
                      ? 'اسأل SA AI أو اطلب تحليل ملف...'
                      : 'Ask SA AI anything...'
                  }
                  className="flex-1 min-h-[40px] max-h-[152px] resize-none border-0 bg-transparent px-1.5 py-2 text-sm sm:text-[15px] font-medium leading-6 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                />

                {/* Right Side (Physical Right in both LTR & RTL): Voice Mic + Circular Upward Arrow Send */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    disabled={isLoading}
                    aria-pressed={isListening}
                    aria-label={
                      isListening
                        ? isArabic
                          ? 'إيقاف الإدخال الصوتي'
                          : 'Stop voice input'
                        : isArabic
                        ? 'الإدخال الصوتي'
                        : 'Voice input'
                    }
                    title={
                      isListening
                        ? isArabic
                          ? `إيقاف الاستماع (${speechLang})`
                          : `Stop listening (${speechLang})`
                        : isArabic
                        ? `تحدّث للكتابة (${speechLang})`
                        : `Speak to type (${speechLang})`
                    }
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 cursor-pointer disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isListening
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/40'
                        : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isListening && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full bg-rose-400/35 animate-ping"
                      />
                    )}
                    <Mic
                      className={`w-[18px] h-[18px] relative z-10 ${
                        isListening ? 'animate-pulse text-rose-600 dark:text-rose-400' : ''
                      }`}
                    />
                  </button>

                  <button
                    type="submit"
                    disabled={!canSend}
                    aria-label={isArabic ? 'إرسال' : 'Send'}
                    title={isArabic ? 'إرسال الرسالة' : 'Send prompt'}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isLoading
                        ? 'bg-slate-900 dark:bg-blue-600 text-white cursor-wait'
                        : canSend
                        ? 'bg-slate-900 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-xs cursor-pointer active:scale-95'
                        : 'bg-slate-200/80 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUp className="w-[18px] h-[18px] stroke-[2.25]" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Subtle Credit Cost & Voice Language Footer Below Input */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 min-w-0">
              <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">
                {isArabic
                  ? 'التكلفة: 1 نقطة للرسالة | 2 نقطة لتحليل PDF'
                  : 'Cost: 1 credit/msg | 2 credits/PDF'}
              </span>
              {attached && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400 tabular-nums whitespace-nowrap">
                    {isArabic ? 'هذا الإرسال: 2 نقطة' : 'This send: 2 credits'}
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (isListening) stopVoiceCapture();
                setSpeechLang((prev) => (prev === 'ar-SA' ? 'en-US' : 'ar-SA'));
              }}
              title={
                isArabic
                  ? 'تبديل لغة الميكروفون (العربية / الإنجليزية)'
                  : 'Switch voice recognition language (ar-SA / en-US)'
              }
              className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer tabular-nums whitespace-nowrap shrink-0"
            >
              {speechLang === 'ar-SA' ? 'Voice: AR (ar-SA)' : 'Voice: EN (en-US)'}
            </button>
          </div>
        </div>
      </aside>

      {/* Wide Preview & AI Results Canvas */}
      <section
        dir={contentDir}
        className="flex-1 h-[calc(100vh-4rem)] overflow-y-auto bg-gray-50 dark:bg-slate-950 p-6 sm:p-8"
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Attached File Live Preview Card */}
          {attached && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  {attached.kind === 'image' ? (
                    <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  )}
                  <span>
                    {isArabic ? `معاينة الملف: ${attached.name}` : `File Preview: ${attached.name}`}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {(attached.size / 1024).toFixed(1)} KB
                </span>
              </div>

              {attached.previewImageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 max-h-72 flex items-center justify-center p-2">
                  <img
                    src={attached.previewImageUrl}
                    alt={attached.name}
                    referrerPolicy="no-referrer"
                    className="max-h-64 w-auto object-contain rounded-lg"
                  />
                </div>
              )}

              {attached.documentText && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 p-3.5 max-h-44 overflow-y-auto text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono">
                  {attached.documentText.slice(0, 1800)}
                  {attached.documentText.length > 1800 ? '\n...' : ''}
                </div>
              )}
            </div>
          )}

          {/* Main AI Result Panel */}
          {activeResult ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h2 className="font-bold text-base text-slate-900 dark:text-white">
                    {isArabic ? 'النتائج والمعاينة' : 'AI Analysis & Result'}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied ? (isArabic ? 'تم النسخ' : 'Copied') : isArabic ? 'نسخ' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleExportPdf()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
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
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <span>{isArabic ? 'جارٍ استقبال الرد...' : 'Receiving streamed response...'}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 text-amber-500" />
              </div>
              <div className="max-w-lg mx-auto space-y-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {isArabic
                    ? 'مساحة عرض النتائج والمعاينة'
                    : 'AI Preview & Results Workspace'}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isArabic
                    ? 'ستظهر هنا معاينة الصور وملفات PDF المرفقة ونتائج التحليل والاختبارات وروابط الأدوات الفورية من Gemini 2.5 Flash مع إمكانية النسخ أو التصدير المباشر.'
                    : 'Attached images, PDF previews, structured analysis, exams, and direct tool action links from Gemini 2.5 Flash stream here live ready to copy or export.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      <UpgradeCreditsModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        locale={locale}
        availableCredits={upgradeCreditInfo?.available ?? credits}
        requiredCredits={upgradeCreditInfo?.required ?? requiredCredits}
      />
    </div>
  );
}

export default AIToolsClient;

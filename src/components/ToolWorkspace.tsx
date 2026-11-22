'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  Upload,
  AlertCircle,
} from 'lucide-react';
import {
  CATEGORY_META,
  TOOLS,
  type ToolDefinition,
} from '@/lib/tools/registry';
import { ToolIcon } from './ToolIcon';
import { useAppStore } from '@/lib/store/useAppStore';
import { useAuth } from './AuthProvider';
import {
  inspectPdfMetadata,
  processTool,
  stampSaAiWatermark,
  type ProcessedResult,
  type ToolOptions,
} from '@/lib/pdf/processors';
import {
  getPdfPageCount,
  renderPdfPageToCanvas,
  renderPdfThumbnails,
  type PageThumbnail,
  type PdfMetadataInfo,
} from '@/lib/pdf/pdfjs';

export function ToolWorkspace({
  tool,
  locale,
}: {
  tool: ToolDefinition;
  locale: string;
}) {
  const { theme, favorites, toggleFavorite, addRecentFile } = useAppStore();
  const { isPaid } = useAuth();
  const isFav = favorites.includes(tool.id);
  const cat = CATEGORY_META[tool.category];

  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedResult | null>(null);

  // Page thumbnails & interactive page state
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [totalPages, setTotalPages] = useState<number>(0);

  // Metadata / Compare state
  const [metadata, setMetadata] = useState<PdfMetadataInfo | null>(null);
  const [compareImages, setCompareImages] = useState<{
    left: string;
    right: string;
    diffPct: string;
    page: number;
  } | null>(null);

  // Iframe integration state (Direct Editor / Sign / Form / Reader)
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [readerBlobUrl, setReaderBlobUrl] = useState<string | null>(null);
  const [iframeActive, setIframeActive] = useState(false);

  // Tool options state
  const [options, setOptions] = useState<ToolOptions>({
    pageRanges: '',
    splitMode: 'ranges',
    rotationAngle: 90,
    blankPosition: 'end',
    blankAfterPage: 1,
    blankCount: 1,
    pagesPerSheet: 4,
    divideAxis: 'vertical',
    posterCols: 2,
    posterRows: 2,
    watermarkText: 'CONFIDENTIAL',
    watermarkPosition: 'diagonal',
    watermarkFontSize: 48,
    watermarkColor: '#2563eb',
    watermarkOpacity: 0.25,
    pageNumberFormat: 'pageOfTotal',
    pageNumberPosition: 'bottomCenter',
    startNumber: 1,
    headerText: '',
    footerText: 'Page {page} of {total}',
    cropMarginPt: 36,
    targetPageSize: 'A4',
    backgroundColor: '#fef9c3',
    imageFormat: 'png',
    imageScale: 2,
    imageQuality: 0.92,
    pageSize: 'fit',
    marginPt: 24,
    rawText: '',
    userPassword: '',
    ownerPassword: '',
    password: '',
    metaTitle: '',
    metaAuthor: '',
    metaSubject: '',
    metaKeywords: '',
    metaCreator: 'SA AI',
    compressionMode: 'standard',
    ocrLanguage: 'eng',
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isTextCreationTool =
    tool.id === 'txt-to-pdf' || tool.id === 'markdown-to-pdf' || tool.id === 'json-to-pdf';

  const needsThumbnails =
    tool.id === 'extract-pages' ||
    tool.id === 'delete-pages' ||
    tool.id === 'organize-pdf' ||
    tool.id === 'split-pdf';

  const handleFilesAdded = useCallback(
    async (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      setError(null);
      setResult(null);

      const nextFiles = tool.multiple ? [...files, ...list] : [list[0]];
      setFiles(nextFiles);

      const first = nextFiles[0];
      const isPdf = first.type === 'application/pdf' || /\.pdf$/i.test(first.name);

      if (tool.mode === 'direct-editor' || tool.mode === 'sign-viewer' || tool.mode === 'form-viewer' || tool.mode === 'pdf-reader') {
        setIframeActive(true);
        if (tool.mode === 'pdf-reader') {
          if (readerBlobUrl) URL.revokeObjectURL(readerBlobUrl);
          const url = URL.createObjectURL(first);
          setReaderBlobUrl(url);
        }
        return;
      }

      if (isPdf) {
        try {
          const bytes = new Uint8Array(await first.arrayBuffer());
          const count = await getPdfPageCount(bytes);
          setTotalPages(count);
          setPageOrder(Array.from({ length: count }, (_, i) => i + 1));
          setSelectedPages([]);

          if (tool.mode === 'metadata-viewer' || tool.id === 'edit-metadata') {
            const info = await inspectPdfMetadata(first);
            setMetadata(info);
            if (tool.id === 'edit-metadata') {
              setOptions((prev) => ({
                ...prev,
                metaTitle: info.title,
                metaAuthor: info.author,
                metaSubject: info.subject,
                metaKeywords: info.keywords,
                metaCreator: info.creator || 'SA AI',
              }));
            }
          }

          if (needsThumbnails) {
            setLoadingThumbs(true);
            try {
              const thumbs = await renderPdfThumbnails(bytes, 36, 0.32);
              setThumbnails(thumbs);
            } finally {
              setLoadingThumbs(false);
            }
          }
        } catch (err) {
          console.warn('PDF inspection skipped:', err);
        }
      }
    },
    [files, needsThumbnails, readerBlobUrl, tool.id, tool.mode, tool.multiple]
  );

  // Send PDF into iframe viewers when ready
  useEffect(() => {
    if (!iframeActive || files.length === 0 || !iframeRef.current) return;

    const sendFileToIframe = async () => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      const buf = await files[0].arrayBuffer();
      if (tool.mode === 'direct-editor' && editorReady) {
        win.postMessage(
          { type: 'PDFCRAFT_LOAD_PDF', payload: { name: files[0].name, buffer: buf } },
          '*'
        );
      } else if (tool.mode === 'sign-viewer' || tool.mode === 'form-viewer') {
        win.postMessage({ type: 'loadPDF', data: new Uint8Array(buf) }, '*');
      }
    };

    const timer = setTimeout(() => {
      void sendFileToIframe();
    }, 350);

    return () => clearTimeout(timer);
  }, [editorReady, files, iframeActive, tool.mode]);

  // Listen for messages from embedded editors/viewers
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'PDFCRAFT_EDITOR_READY') {
        setEditorReady(true);
      } else if (data.type === 'PDFCRAFT_EXIT_EDITOR') {
        setIframeActive(false);
        setFiles([]);
        setEditorReady(false);
      } else if (data.type === 'downloadPDF' && data.data) {
        void (async () => {
          let bytes: Uint8Array = new Uint8Array(data.data);
          if (!isPaid) {
            try {
              bytes = new Uint8Array(await stampSaAiWatermark(bytes));
            } catch {}
          }
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);
          const blob = new Blob([copy], { type: 'application/pdf' });
          triggerDownload(blob, `${files[0]?.name.replace(/\.pdf$/i, '') || 'signed'}-signed.pdf`);
        })();
      } else if (data.type === 'pdfData' && data.data) {
        void (async () => {
          let bytes: Uint8Array = new Uint8Array(data.data);
          if (!isPaid) {
            try {
              bytes = new Uint8Array(await stampSaAiWatermark(bytes));
            } catch {}
          }
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);
          const blob = new Blob([copy], { type: 'application/pdf' });
          triggerDownload(blob, `${files[0]?.name.replace(/\.pdf$/i, '') || 'form'}-filled.pdf`);
        })();
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [files, isPaid]);

  // Sync theme to direct-pdf-editor
  useEffect(() => {
    if (tool.mode === 'direct-editor' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'PDFCRAFT_THEME_CHANGE', payload: { isDark: theme === 'dark' } },
        '*'
      );
    }
  }, [theme, tool.mode]);

  useEffect(() => {
    return () => {
      if (readerBlobUrl) URL.revokeObjectURL(readerBlobUrl);
    };
  }, [readerBlobUrl]);

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleRunCompare = async () => {
    if (files.length < 2) {
      setError('Please upload 2 PDF files to compare.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const b1 = new Uint8Array(await files[0].arrayBuffer());
      const b2 = new Uint8Array(await files[1].arrayBuffer());
      const c1 = await renderPdfPageToCanvas(b1, 1, 1.2);
      const c2 = await renderPdfPageToCanvas(b2, 1, 1.2);

      const ctx1 = c1.getContext('2d');
      const ctx2 = c2.getContext('2d');
      let diffPct = '0.0';
      if (ctx1 && ctx2) {
        const w = Math.min(c1.width, c2.width);
        const h = Math.min(c1.height, c2.height);
        const d1 = ctx1.getImageData(0, 0, w, h).data;
        const d2 = ctx2.getImageData(0, 0, w, h).data;
        let diffPixels = 0;
        const totalPixels = w * h;
        for (let i = 0; i < d1.length; i += 4) {
          if (
            Math.abs(d1[i] - d2[i]) > 20 ||
            Math.abs(d1[i + 1] - d2[i + 1]) > 20 ||
            Math.abs(d1[i + 2] - d2[i + 2]) > 20
          ) {
            diffPixels++;
          }
        }
        diffPct = ((diffPixels / Math.max(1, totalPixels)) * 100).toFixed(2);
      }

      setCompareImages({
        left: c1.toDataURL('image/png'),
        right: c2.toDataURL('image/png'),
        diffPct,
        page: 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (files.length === 0 && !isTextCreationTool) {
      setError('Please select at least one file first.');
      return;
    }
    if (tool.id === 'merge-pdf' && files.length < 2) {
      setError('Please add at least 2 PDF files to merge.');
      return;
    }

    setProcessing(true);
    setProgress(5);
    setStatusMsg('Processing locally in your browser...');
    setError(null);
    setResult(null);

    try {
      const res = await processTool(tool.id, files, {
        ...options,
        selectedPages,
        pageOrder,
        applyFreemiumWatermark: !isPaid,
        onProgress: (pct, msg) => {
          setProgress(pct);
          if (msg) setStatusMsg(msg);
        },
      });
      setResult(res);
      setProgress(100);
      if (files[0]) {
        addRecentFile({
          name: files[0].name,
          size: files[0].size,
          toolId: tool.id,
          toolName: tool.name,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  const moveFile = (idx: number, dir: -1 | 1) => {
    const next = [...files];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFiles(next);
  };

  const movePage = (idx: number, dir: -1 | 1) => {
    const next = [...pageOrder];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setPageOrder(next);
  };

  const toggleSelectPage = (pageNum: number) => {
    setSelectedPages((prev) =>
      prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum].sort((a, b) => a - b)
    );
  };

  const relatedTools = useMemo(
    () => TOOLS.filter((t) => t.category === tool.category && t.id !== tool.id).slice(0, 4),
    [tool.category, tool.id]
  );

  // Full-screen embedded editor/viewer mode
  if (iframeActive && (tool.mode === 'direct-editor' || tool.mode === 'sign-viewer' || tool.mode === 'form-viewer' || tool.mode === 'pdf-reader')) {
    const src =
      tool.mode === 'direct-editor'
        ? `/direct-pdf-editor/index.html?lang=${encodeURIComponent(locale)}&theme=${theme}`
        : tool.mode === 'sign-viewer'
        ? '/pdfjs-viewer/sign-viewer.html'
        : tool.mode === 'form-viewer'
        ? '/pdfjs-viewer/form-viewer.html'
        : `/pdfjs-viewer/viewer.html${readerBlobUrl ? `?file=${encodeURIComponent(readerBlobUrl)}` : ''}`;

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIframeActive(false);
                setFiles([]);
                setEditorReady(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{tool.name}</h1>
            {files[0] && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {files[0].name}
              </span>
            )}
          </div>

          {tool.mode === 'sign-viewer' && (
            <button
              type="button"
              onClick={() => iframeRef.current?.contentWindow?.postMessage({ type: 'save' }, '*')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Save Signed PDF
            </button>
          )}
          {tool.mode === 'form-viewer' && (
            <button
              type="button"
              onClick={() => iframeRef.current?.contentWindow?.postMessage({ type: 'getData' }, '*')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Filled Form
            </button>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg h-[78vh] min-h-[560px]">
          <iframe
            ref={iframeRef}
            src={src}
            title={tool.name}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb + Header */}
      <div className="space-y-4">
        <Link
          href={`/${locale}/tools`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        >
          <ArrowLeft className="w-4 h-4" />
          All Tools
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${cat.bgLight} ${cat.bgDark} ${cat.color}`}
            >
              <ToolIcon name={tool.icon} className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  {tool.name}
                </h1>
                {tool.badge && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {tool.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{tool.description}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleFavorite(tool.id)}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
              isFav
                ? 'border-amber-300 bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:border-amber-800'
                : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-amber-500'
            }`}
            title="Toggle favorite"
          >
            <Star className={`w-5 h-5 ${isFav ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files) void handleFilesAdded(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragging
              ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
              : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 bg-slate-50/60 dark:bg-slate-950/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={tool.accept}
            multiple={Boolean(tool.multiple)}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFilesAdded(e.target.files);
              e.target.value = '';
            }}
          />
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-900 dark:text-white">
            Drag &amp; drop {tool.multiple ? 'files' : 'a file'} here, or click to browse
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Accepted: {tool.accept} • 100% client-side processing
          </p>

          {tool.mode === 'direct-editor' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIframeActive(true);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium cursor-pointer"
            >
              Open Blank Direct PDF Editor
            </button>
          )}
        </div>

        {/* Text input area for TXT/Markdown/JSON to PDF */}
        {isTextCreationTool && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Or paste / type content directly
            </label>
            <textarea
              rows={7}
              value={options.rawText || ''}
              onChange={(e) => setOptions((p) => ({ ...p, rawText: e.target.value }))}
              placeholder={
                tool.id === 'json-to-pdf'
                  ? '{\n  "title": "Sample Document",\n  "items": [1, 2, 3]\n}'
                  : tool.id === 'markdown-to-pdf'
                  ? '# Heading\n\nWrite **Markdown** content here...'
                  : 'Enter plain text to convert into a PDF document...'
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Uploaded File List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Selected Files ({files.length})
              </h2>
              <div className="flex items-center gap-2">
                {tool.multiple && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add More
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFiles([]);
                    setThumbnails([]);
                    setMetadata(null);
                    setCompareImages(null);
                    setResult(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {files.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {f.name}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {files.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => moveFile(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFile(idx, 1)}
                          disabled={idx === files.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata Viewer Mode */}
        {tool.mode === 'metadata-viewer' && metadata && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Document Properties ({metadata.pageCount} pages)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                ['Title', metadata.title || '—'],
                ['Author', metadata.author || '—'],
                ['Subject', metadata.subject || '—'],
                ['Keywords', metadata.keywords || '—'],
                ['Creator', metadata.creator || '—'],
                ['Producer', metadata.producer || '—'],
                ['Created', metadata.creationDate || '—'],
                ['Modified', metadata.modificationDate || '—'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <div className="text-xs text-slate-500">{k}</div>
                  <div className="font-medium text-slate-900 dark:text-slate-100 break-all">{v}</div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Page</th>
                    <th className="px-4 py-2">Points (pt)</th>
                    <th className="px-4 py-2">Inches (in)</th>
                    <th className="px-4 py-2">Orientation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metadata.pages.map((p) => (
                    <tr key={p.pageNumber}>
                      <td className="px-4 py-2 font-medium">#{p.pageNumber}</td>
                      <td className="px-4 py-2">
                        {p.widthPt} × {p.heightPt}
                      </td>
                      <td className="px-4 py-2">
                        {p.widthIn}&quot; × {p.heightIn}&quot;
                      </td>
                      <td className="px-4 py-2">
                        {p.widthPt >= p.heightPt ? 'Landscape' : 'Portrait'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Compare Mode */}
        {tool.mode === 'compare' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleRunCompare}
              disabled={files.length < 2 || processing}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
            >
              {processing ? 'Comparing...' : 'Compare Page 1 Side-by-Side'}
            </button>
            {compareImages && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Visual Difference: <span className="font-bold text-blue-600">{compareImages.diffPct}%</span> pixels differ
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2 bg-slate-50 dark:bg-slate-950">
                    <div className="text-xs font-medium text-slate-500 mb-2">{files[0]?.name}</div>
                    <img src={compareImages.left} alt="PDF 1" className="w-full rounded-lg border" />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2 bg-slate-50 dark:bg-slate-950">
                    <div className="text-xs font-medium text-slate-500 mb-2">{files[1]?.name}</div>
                    <img src={compareImages.right} alt="PDF 2" className="w-full rounded-lg border" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Interactive Thumbnail Grid for page selection / organization */}
        {needsThumbnails && files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {tool.id === 'organize-pdf'
                  ? 'Reorder Pages'
                  : tool.id === 'delete-pages'
                  ? 'Click Pages to Mark for Deletion'
                  : 'Click Pages to Select (or enter range below)'}
              </h3>
              {totalPages > 0 && (
                <span className="text-xs text-slate-500">{totalPages} pages total</span>
              )}
            </div>

            {loadingThumbs ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Rendering page thumbnails...
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3 max-h-80 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {(tool.id === 'organize-pdf'
                  ? pageOrder.map((pNum, orderIdx) => ({
                      thumb: thumbnails.find((t) => t.pageNumber === pNum),
                      pageNumber: pNum,
                      orderIdx,
                    }))
                  : thumbnails.map((t, idx) => ({
                      thumb: t,
                      pageNumber: t.pageNumber,
                      orderIdx: idx,
                    }))
                ).map(({ thumb, pageNumber, orderIdx }) => {
                  if (!thumb) return null;
                  const active = selectedPages.includes(pageNumber);
                  return (
                    <div
                      key={`${pageNumber}-${orderIdx}`}
                      onClick={() => {
                        if (tool.id !== 'organize-pdf') toggleSelectPage(pageNumber);
                      }}
                      className={`relative rounded-lg border p-1.5 bg-white dark:bg-slate-900 transition-all cursor-pointer ${
                        active
                          ? tool.id === 'delete-pages'
                            ? 'border-rose-500 ring-2 ring-rose-500/30'
                            : 'border-blue-600 ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      <img
                        src={thumb.dataUrl}
                        alt={`Page ${pageNumber}`}
                        className="w-full h-auto rounded"
                      />
                      <div className="mt-1 flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        <span>P.{pageNumber}</span>
                        {tool.id === 'organize-pdf' && (
                          <div className="flex gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                movePage(orderIdx, -1);
                              }}
                              className="px-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              ←
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                movePage(orderIdx, 1);
                              }}
                              className="px-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tool-specific Option Controls */}
        {tool.mode !== 'metadata-viewer' && tool.mode !== 'compare' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {(tool.id === 'split-pdf' ||
              tool.id === 'extract-pages' ||
              tool.id === 'delete-pages' ||
              tool.id === 'rotate-pdf' ||
              tool.id === 'pdf-to-image' ||
              tool.id === 'ocr-pdf') && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Page Ranges (e.g., 1-3, 5)
                </label>
                <input
                  type="text"
                  value={options.pageRanges || ''}
                  onChange={(e) => setOptions((p) => ({ ...p, pageRanges: e.target.value }))}
                  placeholder="All pages"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            )}

            {tool.id === 'split-pdf' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Split Mode
                </label>
                <select
                  value={options.splitMode}
                  onChange={(e) =>
                    setOptions((p) => ({
                      ...p,
                      splitMode: e.target.value as ToolOptions['splitMode'],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="ranges">Extract by Page Range</option>
                  <option value="everyPage">Split Every Page (ZIP)</option>
                  <option value="evenOdd">Split Even / Odd Pages (ZIP)</option>
                </select>
              </div>
            )}

            {tool.id === 'rotate-pdf' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Rotation Angle
                </label>
                <select
                  value={options.rotationAngle}
                  onChange={(e) =>
                    setOptions((p) => ({ ...p, rotationAngle: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value={90}>90° Clockwise</option>
                  <option value={180}>180°</option>
                  <option value={270}>270° (90° Counter-clockwise)</option>
                </select>
              </div>
            )}

            {tool.id === 'add-blank-page' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Position
                  </label>
                  <select
                    value={options.blankPosition}
                    onChange={(e) =>
                      setOptions((p) => ({
                        ...p,
                        blankPosition: e.target.value as 'start' | 'end' | 'after',
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="end">At End</option>
                    <option value="start">At Beginning</option>
                    <option value="after">After Page #</option>
                  </select>
                </div>
                {options.blankPosition === 'after' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      After Page Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={options.blankAfterPage || 1}
                      onChange={(e) =>
                        setOptions((p) => ({ ...p, blankAfterPage: Number(e.target.value) }))
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </>
            )}

            {tool.id === 'n-up-pdf' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Pages Per Sheet
                </label>
                <select
                  value={options.pagesPerSheet}
                  onChange={(e) =>
                    setOptions((p) => ({
                      ...p,
                      pagesPerSheet: Number(e.target.value) as 2 | 4 | 6 | 9,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value={2}>2-up</option>
                  <option value={4}>4-up</option>
                  <option value={6}>6-up</option>
                  <option value={9}>9-up</option>
                </select>
              </div>
            )}

            {tool.id === 'watermark' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Watermark Text
                  </label>
                  <input
                    type="text"
                    value={options.watermarkText || ''}
                    onChange={(e) => setOptions((p) => ({ ...p, watermarkText: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Position
                  </label>
                  <select
                    value={options.watermarkPosition}
                    onChange={(e) =>
                      setOptions((p) => ({
                        ...p,
                        watermarkPosition: e.target.value as ToolOptions['watermarkPosition'],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="diagonal">Diagonal</option>
                    <option value="center">Center</option>
                    <option value="topLeft">Top Left</option>
                    <option value="topRight">Top Right</option>
                    <option value="bottomLeft">Bottom Left</option>
                    <option value="bottomRight">Bottom Right</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={options.watermarkColor || '#2563eb'}
                    onChange={(e) => setOptions((p) => ({ ...p, watermarkColor: e.target.value }))}
                    className="h-9 w-20 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Opacity ({Math.round((options.watermarkOpacity ?? 0.25) * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0.05}
                    max={0.9}
                    step={0.05}
                    value={options.watermarkOpacity ?? 0.25}
                    onChange={(e) =>
                      setOptions((p) => ({ ...p, watermarkOpacity: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                </div>
              </>
            )}

            {tool.id === 'page-numbers' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Number Format
                  </label>
                  <select
                    value={options.pageNumberFormat}
                    onChange={(e) =>
                      setOptions((p) => ({
                        ...p,
                        pageNumberFormat: e.target.value as ToolOptions['pageNumberFormat'],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="pageOfTotal">Page 1 of N</option>
                    <option value="number">1, 2, 3</option>
                    <option value="roman">I, II, III</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Position
                  </label>
                  <select
                    value={options.pageNumberPosition}
                    onChange={(e) =>
                      setOptions((p) => ({
                        ...p,
                        pageNumberPosition: e.target.value as ToolOptions['pageNumberPosition'],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="bottomCenter">Bottom Center</option>
                    <option value="bottomRight">Bottom Right</option>
                    <option value="bottomLeft">Bottom Left</option>
                    <option value="topCenter">Top Center</option>
                    <option value="topRight">Top Right</option>
                    <option value="topLeft">Top Left</option>
                  </select>
                </div>
              </>
            )}

            {tool.id === 'header-footer' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Header Text (supports {'{page}'}, {'{total}'}, {'{date}'})
                  </label>
                  <input
                    type="text"
                    value={options.headerText || ''}
                    onChange={(e) => setOptions((p) => ({ ...p, headerText: e.target.value }))}
                    placeholder="Optional header"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Footer Text
                  </label>
                  <input
                    type="text"
                    value={options.footerText || ''}
                    onChange={(e) => setOptions((p) => ({ ...p, footerText: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {tool.id === 'crop-pdf' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Trim Margin (points, 72pt = 1 inch)
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={options.cropMarginPt ?? 36}
                  onChange={(e) => setOptions((p) => ({ ...p, cropMarginPt: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            )}

            {tool.id === 'fix-page-size' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Target Standard Size
                </label>
                <select
                  value={options.targetPageSize}
                  onChange={(e) =>
                    setOptions((p) => ({
                      ...p,
                      targetPageSize: e.target.value as 'A4' | 'Letter' | 'A3' | 'Legal',
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="A4">A4 (595 × 842 pt)</option>
                  <option value="Letter">US Letter (612 × 792 pt)</option>
                  <option value="A3">A3 (842 × 1191 pt)</option>
                  <option value="Legal">US Legal (612 × 1008 pt)</option>
                </select>
              </div>
            )}

            {tool.id === 'background-color' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Background Paper Color
                </label>
                <input
                  type="color"
                  value={options.backgroundColor || '#fef9c3'}
                  onChange={(e) => setOptions((p) => ({ ...p, backgroundColor: e.target.value }))}
                  className="h-9 w-24 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                />
              </div>
            )}

            {tool.id === 'image-to-pdf' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Page Size
                </label>
                <select
                  value={options.pageSize}
                  onChange={(e) =>
                    setOptions((p) => ({
                      ...p,
                      pageSize: e.target.value as 'fit' | 'A4' | 'Letter',
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="fit">Fit to Image</option>
                  <option value="A4">A4</option>
                  <option value="Letter">US Letter</option>
                </select>
              </div>
            )}

            {tool.id === 'pdf-to-image' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Output Image Format
                </label>
                <select
                  value={options.imageFormat}
                  onChange={(e) =>
                    setOptions((p) => ({
                      ...p,
                      imageFormat: e.target.value as 'png' | 'jpeg' | 'webp',
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="png">PNG (Lossless)</option>
                  <option value="jpeg">JPG (Compact)</option>
                  <option value="webp">WebP (Modern)</option>
                </select>
              </div>
            )}

            {tool.id === 'compress-pdf' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Compression Level
                </label>
                <select
                  value={options.compressionMode}
                  onChange={(e) =>
                    setOptions((p) => ({
                      ...p,
                      compressionMode: e.target.value as 'standard' | 'rasterize',
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="standard">Lossless Object Stream Optimization</option>
                  <option value="rasterize">Strong Compression (Rasterize &amp; JPEG)</option>
                </select>
              </div>
            )}

            {tool.id === 'encrypt-pdf' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    User Password (to open PDF)
                  </label>
                  <input
                    type="password"
                    value={options.userPassword || ''}
                    onChange={(e) => setOptions((p) => ({ ...p, userPassword: e.target.value }))}
                    placeholder="Enter password"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Owner Password (optional)
                  </label>
                  <input
                    type="password"
                    value={options.ownerPassword || ''}
                    onChange={(e) => setOptions((p) => ({ ...p, ownerPassword: e.target.value }))}
                    placeholder="Same as user password if blank"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {tool.id === 'decrypt-pdf' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Document Password
                </label>
                <input
                  type="password"
                  value={options.password || ''}
                  onChange={(e) => setOptions((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Enter PDF password"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            )}

            {tool.id === 'edit-metadata' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={options.metaTitle || ''}
                    onChange={(e) => setOptions((p) => ({ ...p, metaTitle: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Author
                  </label>
                  <input
                    type="text"
                    value={options.metaAuthor || ''}
                    onChange={(e) => setOptions((p) => ({ ...p, metaAuthor: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={options.metaSubject || ''}
                    onChange={(e) => setOptions((p) => ({ ...p, metaSubject: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={options.metaKeywords || ''}
                    onChange={(e) => setOptions((p) => ({ ...p, metaKeywords: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {tool.id === 'ocr-pdf' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  OCR Language
                </label>
                <select
                  value={options.ocrLanguage}
                  onChange={(e) => setOptions((p) => ({ ...p, ocrLanguage: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="eng">English (eng)</option>
                  <option value="spa">Spanish (spa)</option>
                  <option value="fra">French (fra)</option>
                  <option value="deu">German (deu)</option>
                  <option value="chi_sim">Chinese Simplified (chi_sim)</option>
                  <option value="jpn">Japanese (jpn)</option>
                  <option value="ara">Arabic (ara)</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        {tool.mode !== 'metadata-viewer' && tool.mode !== 'compare' && (
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleProcess}
              disabled={processing || (files.length === 0 && !isTextCreationTool)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing ({progress}%)
                </>
              ) : (
                <>Run {tool.name}</>
              )}
            </button>

            {processing && statusMsg && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{statusMsg}</span>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success / Download Card */}
        {result && (
          <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-200">
                  Ready to Download: {result.fileName}
                </h3>
                {result.summary && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {result.summary}
                  </p>
                )}
                {result.mimeType === 'application/pdf' && (
                  <p className="text-xs mt-1 text-slate-600">
                    {isPaid ? (
                      locale === 'ar'
                        ? 'حساب مدفوع: تم تصدير الملف بدون علامة مائية.'
                        : 'Paid plan: Exported cleanly without watermark.'
                    ) : (
                      <>
                        {locale === 'ar'
                          ? 'يتضمن علامة SA AI المائية الخفيفة · '
                          : 'Includes subtle SA AI watermark · '}
                        <Link
                          href={`/${locale}/pricing`}
                          className="font-semibold text-blue-700 underline hover:text-blue-800"
                        >
                          {locale === 'ar' ? 'قم بالترقية لإزالتها تلقائياً' : 'Upgrade to remove'}
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => triggerDownload(result.blob, result.fileName)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        )}
      </div>

      {/* Related Tools */}
      {relatedTools.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Related Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedTools.map((rt) => (
              <Link
                key={rt.id}
                href={`/${locale}/tools/${rt.slug}`}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 transition-colors flex items-center gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${cat.bgLight} ${cat.bgDark} ${cat.color}`}
                >
                  <ToolIcon name={rt.icon} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {rt.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{rt.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

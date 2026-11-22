import { setRequestLocale } from 'next-intl/server';
import { HardDrive, Lock, ShieldCheck } from 'lucide-react';

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          Zero-Upload Privacy Architecture
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
          Privacy Policy
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Your documents never leave your device. All PDF processing happens locally in your browser.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2">
          <Lock className="w-6 h-6 text-blue-600" />
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">
            100% Client-Side Processing
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Every PDF merge, split, edit, OCR scan, signature, and encryption runs directly inside your browser via WebAssembly and JavaScript. No document bytes are ever transmitted to external servers.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2">
          <HardDrive className="w-6 h-6 text-emerald-600" />
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">
            Local Storage Only
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Theme preferences, favorite tools, and recent file names are stored solely in your browser&apos;s local storage and can be cleared anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

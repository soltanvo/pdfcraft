'use client';

export function BrandLogo() {
  return (
    <div className="flex items-center gap-3 shrink-0">
      <img
        src="/logo.png"
        alt="SA AI"
        referrerPolicy="no-referrer"
        className="h-12 w-12 rounded-xl object-contain shrink-0"
      />
      <span
        dir="ltr"
        className="inline-flex items-center whitespace-nowrap text-xl sm:text-2xl tracking-tight select-none"
      >
        <span className="font-black text-slate-900">SA</span>
        <span className="sa-gold-divider font-bold mx-1.5" aria-hidden="true">
          |
        </span>
        <span className="sa-ai-3d-gold font-black">AI</span>
      </span>
    </div>
  );
}

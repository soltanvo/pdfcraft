'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { TOOLS } from '@/lib/tools/registry';
import { ToolIcon } from './ToolIcon';

export function HomeSearchBar({
  locale,
  placeholder,
}: {
  locale: string;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');

  const matches = query.trim()
    ? TOOLS.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.description.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  return (
    <div className="relative max-w-xl mx-auto">
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute start-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full ps-12 pe-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {matches.length > 0 && (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden text-left">
          {matches.map((tool) => (
            <Link
              key={tool.id}
              href={`/${locale}/tools/${tool.slug}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b last:border-b-0 border-slate-100 dark:border-slate-800"
            >
              <ToolIcon name={tool.icon} className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {tool.name}
                </div>
                <div className="text-xs text-slate-500 truncate">{tool.description}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

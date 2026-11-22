'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, Star } from 'lucide-react';
import {
  CATEGORY_META,
  TOOLS,
  type ToolCategory,
} from '@/lib/tools/registry';
import { ToolCard } from './ToolCard';
import { useAppStore } from '@/lib/store/useAppStore';

const CATEGORIES: ToolCategory[] = [
  'organizeManage',
  'editAnnotate',
  'convertToPdf',
  'convertFromPdf',
  'optimizeRepair',
  'securePdf',
];

export function ToolsCatalogClient({ locale }: { locale: string }) {
  const tHome = useTranslations('home');
  const tToolsPage = useTranslations('toolsPage');
  const searchParams = useSearchParams();
  const initialCat = searchParams.get('category') as ToolCategory | 'favorites' | null;

  const [selectedCat, setSelectedCat] = useState<ToolCategory | 'all' | 'favorites'>(
    initialCat || 'all'
  );
  const [query, setQuery] = useState('');
  const favorites = useAppStore((s) => s.favorites);

  const filtered = useMemo(() => {
    return TOOLS.filter((tool) => {
      if (selectedCat === 'favorites' && !favorites.includes(tool.id)) return false;
      if (
        selectedCat !== 'all' &&
        selectedCat !== 'favorites' &&
        tool.category !== selectedCat
      ) {
        return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          tool.name.toLowerCase().includes(q) ||
          tool.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [favorites, query, selectedCat]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {tToolsPage('title')}
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {tToolsPage('subtitle', { count: TOOLS.length })}
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedCat('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            selectedCat === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {tToolsPage('allTools')} ({TOOLS.length})
        </button>

        <button
          type="button"
          onClick={() => setSelectedCat('favorites')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            selectedCat === 'favorites'
              ? 'bg-amber-500 text-white'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Star className="w-3.5 h-3.5" />
          Favorites ({favorites.length})
        </button>

        {CATEGORIES.map((catId) => {
          const count = TOOLS.filter((t) => t.category === catId).length;
          return (
            <button
              key={catId}
              type="button"
              onClick={() => setSelectedCat(catId)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedCat === catId
                  ? 'bg-blue-600 text-white'
                  : `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`
              }`}
            >
              {tHome(`categories.${catId}`)} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400">{tToolsPage('noToolsFound')}</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSelectedCat('all');
            }}
            className="mt-3 text-sm font-semibold text-blue-600 hover:underline cursor-pointer"
          >
            {tToolsPage('clearFilters')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((tool) => (
            <ToolCard key={tool.id} tool={tool} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

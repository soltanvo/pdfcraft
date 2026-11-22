'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { CATEGORY_META, type ToolDefinition } from '@/lib/tools/registry';
import { ToolIcon } from './ToolIcon';
import { useAppStore } from '@/lib/store/useAppStore';

export function ToolCard({ tool, locale }: { tool: ToolDefinition; locale: string }) {
  const { favorites, toggleFavorite } = useAppStore();
  const isFav = favorites.includes(tool.id);
  const cat = CATEGORY_META[tool.category];

  return (
    <div className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col justify-between">
      <Link href={`/${locale}/tools/${tool.slug}`} className="block space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center ${cat.bgLight} ${cat.bgDark} ${cat.color}`}
          >
            <ToolIcon name={tool.icon} className="w-5 h-5" />
          </div>
          {tool.badge && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {tool.badge}
            </span>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {tool.name}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
            {tool.description}
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          toggleFavorite(tool.id);
        }}
        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        className={`absolute top-4 end-4 p-1.5 rounded-md transition-colors cursor-pointer ${
          isFav
            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
            : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-500'
        }`}
      >
        <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
      </button>
    </div>
  );
}

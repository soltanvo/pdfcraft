import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ArrowRight,
  Cpu,
  Lock,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import {
  CATEGORY_META,
  TOOLS,
  getPopularTools,
  getToolsByCategory,
  type ToolCategory,
} from '@/lib/tools/registry';
import { ToolCard } from '@/components/ToolCard';
import { ToolIcon } from '@/components/ToolIcon';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { locales } from '@/lib/i18n/config';

const CATEGORIES: ToolCategory[] = [
  'organizeManage',
  'editAnnotate',
  'convertToPdf',
  'convertFromPdf',
  'optimizeRepair',
  'securePdf',
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tCommon = await getTranslations('common');

  const popular = getPopularTools();

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-blue-50/70 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/70 text-blue-700 dark:text-blue-300 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>{tCommon('footer.privacyBadge')}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto">
            {t('hero.title')}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            {t('hero.subtitle')}
          </p>

          <HomeSearchBar locale={locale} placeholder={tCommon('search.placeholder')} />

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={`/${locale}/tools`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-colors"
            >
              <span>{t('hero.cta')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/${locale}/ai`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-sm transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{locale === 'ar' ? 'مساعد الذكاء الاصطناعي' : tCommon('navigation.aiTools')}</span>
            </Link>
            <Link
              href={`/${locale}/workflow`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-colors"
            >
              <Workflow className="w-4 h-4 text-blue-600" />
              <span>{tCommon('navigation.workflow')}</span>
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto pt-8">
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {TOOLS.length}+
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('stats.pdfTools')}</div>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">100%</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('stats.freeToUse')}</div>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {locales.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('stats.languages')}</div>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">0</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('stats.filesUploaded')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Tools */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              {t('popularTools.badge')}
            </span>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t('popularTools.title')}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t('popularTools.description')}
            </p>
          </div>
          <Link
            href={`/${locale}/tools`}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
          >
            View all tools <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {popular.map((tool) => (
            <ToolCard key={tool.id} tool={tool} locale={locale} />
          ))}
        </div>
      </section>

      {/* Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {t('categoriesSection.title')}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('categoriesSection.description', { count: TOOLS.length })}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CATEGORIES.map((catId) => {
            const meta = CATEGORY_META[catId];
            const catTools = getToolsByCategory(catId);
            return (
              <Link
                key={catId}
                href={`/${locale}/tools?category=${catId}`}
                className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 hover:border-blue-400 dark:hover:border-blue-600 transition-all shadow-xs hover:shadow-md flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center ${meta.bgLight} ${meta.bgDark} ${meta.color}`}
                  >
                    <ToolIcon name={meta.icon} className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {t('categoriesSection.toolsCount', { count: catTools.length })}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {t(`categories.${catId}`)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {t(`categoriesDescription.${catId}`)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              {t('features.privacy.title')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('features.privacy.description')}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              {t('features.free.title')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('features.free.description')}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              {t('features.powerful.title')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('features.powerful.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Workflow Editor Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              <Workflow className="w-4 h-4" /> Visual Node Pipeline
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Automate Multi-Step PDF Workflows
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Chain compression, watermarking, page numbering, metadata removal, and flattening on a visual canvas. Everything executes sequentially right in your browser.
            </p>
            <Link
              href={`/${locale}/workflow`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              Launch Workflow Editor <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            <img
              src="/images/workflow-editor-screenshot.png"
              alt="SA AI Visual Workflow Editor"
              referrerPolicy="no-referrer"
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

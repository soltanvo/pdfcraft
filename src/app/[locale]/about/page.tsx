import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, Code2, Cpu, Globe, Heart, Lock, Zap } from 'lucide-react';
import { TOOLS } from '@/lib/tools/registry';

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('aboutPage');
  const brand = 'SA AI';
  const count = TOOLS.length;

  const values = [
    { key: 'privacy', icon: Lock },
    { key: 'fast', icon: Zap },
    { key: 'accessible', icon: Globe },
    { key: 'free', icon: Heart },
    { key: 'openSource', icon: Code2 },
    { key: 'community', icon: Cpu },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
          {t('title', { brand })}
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
          {t('description', { brand, count })}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('mission.title')}</h2>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t('mission.p1', { brand })}</p>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t('mission.p2', { brand })}</p>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t('mission.p3', { brand })}</p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('values.title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {values.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {t(`values.${key}.title`)}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t(`values.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20 p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('cta.title')}</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          {t('cta.description', { brand, count })}
        </p>
        <Link
          href={`/${locale}/tools`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
        >
          <span>{t('cta.button')}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}

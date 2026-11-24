import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { HelpCircle } from 'lucide-react';

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('faqPage');
  const messages = (await getMessages()) as {
    faqPage?: {
      sections?: Record<string, Record<string, { question: string; answer: string }>>;
      categories?: Record<string, string>;
    };
  };

  const sections = messages.faqPage?.sections || {};
  const categories = messages.faqPage?.categories || {};

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">{t('subtitle', { brand: 'SA AI' })}</p>
      </div>

      <div className="space-y-8">
        {Object.entries(sections).map(([sectionKey, entries]) => (
          <section key={sectionKey} className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
              {categories[sectionKey] || sectionKey}
            </h2>
            <div className="space-y-3">
              {Object.entries(entries).map(([qKey, qa]) => (
                <details
                  key={qKey}
                  className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
                >
                  <summary className="font-semibold text-slate-900 dark:text-white cursor-pointer list-none flex items-center justify-between gap-4">
                    <span>{qa.question}</span>
                    <span className="text-slate-400 group-open:rotate-45 transition-transform text-lg">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {qa.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

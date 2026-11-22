import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isValidLocale } from '@/lib/i18n/config';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isValidLocale(requested) ? requested : defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});

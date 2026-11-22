export const locales = [
  'en',
  'zh',
  'zh-TW',
  'ja',
  'ko',
  'es',
  'fr',
  'de',
  'pt',
  'ar',
  'he',
  'it',
  'id',
  'vi',
  'ro',
  'pl',
  'cs',
  'hi',
  'ta',
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ar';

export interface LocaleMeta {
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

export const localeConfig: Record<Locale, LocaleMeta> = {
  en: { name: 'English', nativeName: 'English', direction: 'ltr' },
  zh: { name: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr' },
  'zh-TW': { name: 'Chinese (Traditional)', nativeName: '繁體中文', direction: 'ltr' },
  ja: { name: 'Japanese', nativeName: '日本語', direction: 'ltr' },
  ko: { name: 'Korean', nativeName: '한국어', direction: 'ltr' },
  es: { name: 'Spanish', nativeName: 'Español', direction: 'ltr' },
  fr: { name: 'French', nativeName: 'Français', direction: 'ltr' },
  de: { name: 'German', nativeName: 'Deutsch', direction: 'ltr' },
  pt: { name: 'Portuguese', nativeName: 'Português', direction: 'ltr' },
  ar: { name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
  he: { name: 'Hebrew', nativeName: 'עברית', direction: 'rtl' },
  it: { name: 'Italian', nativeName: 'Italiano', direction: 'ltr' },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr' },
  ro: { name: 'Romanian', nativeName: 'Română', direction: 'ltr' },
  pl: { name: 'Polish', nativeName: 'Polski', direction: 'ltr' },
  cs: { name: 'Czech', nativeName: 'Čeština', direction: 'ltr' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' },
  ta: { name: 'Tamil', nativeName: 'தமிழ்', direction: 'ltr' },
};

export function isValidLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getDirection(locale: string): 'ltr' | 'rtl' {
  if (isValidLocale(locale)) {
    return localeConfig[locale].direction;
  }
  return 'ltr';
}

import { Plus_Jakarta_Sans, Noto_Sans_Arabic, JetBrains_Mono } from 'next/font/google';

export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans-en',
  preload: true,
});

export const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-arabic',
  preload: true,
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  preload: false,
});

export function fontVariablesFor(direction: 'ltr' | 'rtl'): string {
  if (direction === 'rtl') {
    return `${notoSansArabic.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`;
  }
  return `${plusJakartaSans.variable} ${notoSansArabic.variable} ${jetbrainsMono.variable}`;
}

/**
 * Site configuration
 */

export const siteConfig = {
  name: 'SA AI',
  description: 'أدوات PDF - مجانية، خاصة وتعتمد على المتصفح. دمج، تقسيم، ضغط، تحويل وتحرير ملفات PDF على الإنترنت دون رفعها للخوادم.',
  url: 'https://pdfcraft.devtoolcafe.com',
  ogImage: '/images/og-image.png',
  links: {
    github: 'https://github.com/PDFCraftTool/pdfcraft',
    twitter: 'https://twitter.com/pdfcraft',
  },
  creator: '[فريق المنصة]',
  keywords: [
    'أدوات PDF',
    'محرر PDF',
    'دمج PDF',
    'تقسيم PDF',
    'ضغط PDF',
    'تحويل PDF',
    'أدوات PDF مجانية',
    'محرر PDF على الإنترنت',
    'يعتمد على المتصفح',
    'معالجة خاصة لملفات PDF',
  ],
  // SEO-related settings
  seo: {
    titleTemplate: '%s | SA AI',
    defaultTitle: 'SA AI - أدوات PDF',
    twitterHandle: '@pdfcraft',
    locale: 'en_US',
  },
};

/**
 * Navigation configuration
 */

export const navConfig = {
  mainNav: [
    { title: 'Home', href: '/' },
    { title: 'Tools', href: '/tools' },
    { title: 'About', href: '/about' },
    { title: 'FAQ', href: '/faq' },
  ],
  footerNav: [
    { title: 'Privacy', href: '/privacy' },
    { title: 'Contact', href: '/contact' },
  ],
};
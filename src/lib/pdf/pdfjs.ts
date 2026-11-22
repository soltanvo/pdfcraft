export interface PageThumbnail {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface PdfMetadataInfo {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
  pageCount: number;
  fileSize: number;
  pages: { pageNumber: number; widthPt: number; heightPt: number; widthIn: string; heightIn: string }[];
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only run in the browser');
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function getPdfPageCount(data: Uint8Array): Promise<number> {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({
    data: data.slice(),
    cMapUrl: '/pdfjs-viewer/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs-viewer/standard_fonts/',
  }).promise;
  const count = doc.numPages;
  await doc.destroy();
  return count;
}

export async function renderPdfThumbnails(
  data: Uint8Array,
  maxPages = 40,
  scale = 0.35
): Promise<PageThumbnail[]> {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({
    data: data.slice(),
    cMapUrl: '/pdfjs-viewer/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs-viewer/standard_fonts/',
  }).promise;

  const total = Math.min(doc.numPages, maxPages);
  const thumbs: PageThumbnail[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
      thumbs.push({
        pageNumber: i,
        dataUrl: canvas.toDataURL('image/png'),
        width: viewport.width,
        height: viewport.height,
      });
    }
    page.cleanup();
  }

  await doc.destroy();
  return thumbs;
}

export async function renderPdfPageToCanvas(
  data: Uint8Array,
  pageNumber: number,
  scale = 2,
  options?: { greyscale?: boolean; invert?: boolean }
): Promise<HTMLCanvasElement> {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({
    data: data.slice(),
    cMapUrl: '/pdfjs-viewer/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs-viewer/standard_fonts/',
  }).promise;

  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    await doc.destroy();
    throw new Error('Could not acquire 2D canvas context');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  if (options?.greyscale || options?.invert) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (options.greyscale) {
        const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = d[i + 1] = d[i + 2] = lum;
      }
      if (options.invert) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  page.cleanup();
  await doc.destroy();
  return canvas;
}

export async function extractPdfTextByPage(
  data: Uint8Array
): Promise<{ pageNumber: number; text: string; width: number; height: number }[]> {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({
    data: data.slice(),
    cMapUrl: '/pdfjs-viewer/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs-viewer/standard_fonts/',
  }).promise;

  const pages: { pageNumber: number; text: string; width: number; height: number }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({
      pageNumber: i,
      text,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    });
    page.cleanup();
  }

  await doc.destroy();
  return pages;
}

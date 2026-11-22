import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { marked } from 'marked';
import {
  extractPdfTextByPage,
  getPdfPageCount,
  renderPdfPageToCanvas,
  PdfMetadataInfo,
} from './pdfjs';
import { runQpdf } from './qpdf';

export interface ProcessedResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  summary?: string;
}

export interface ToolOptions {
  // Ranges / Page selection
  pageRanges?: string;
  splitMode?: 'ranges' | 'everyPage' | 'evenOdd';
  selectedPages?: number[];
  pageOrder?: number[];
  // Rotate
  rotationAngle?: number;
  // Blank page
  blankPosition?: 'start' | 'end' | 'after';
  blankAfterPage?: number;
  blankCount?: number;
  // N-up / Grid
  pagesPerSheet?: 2 | 4 | 6 | 9;
  // Divide / Posterize
  divideAxis?: 'vertical' | 'horizontal';
  posterCols?: number;
  posterRows?: number;
  // Watermark
  watermarkText?: string;
  watermarkPosition?: 'diagonal' | 'center' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  watermarkFontSize?: number;
  watermarkColor?: string;
  watermarkOpacity?: number;
  // Page numbers / Header & Footer
  pageNumberFormat?: 'number' | 'roman' | 'pageOfTotal';
  pageNumberPosition?: 'bottomCenter' | 'bottomRight' | 'bottomLeft' | 'topCenter' | 'topRight' | 'topLeft';
  startNumber?: number;
  headerText?: string;
  footerText?: string;
  // Crop / Fix Page Size / Background Color
  cropMarginPt?: number;
  targetPageSize?: 'A4' | 'Letter' | 'A3' | 'Legal';
  backgroundColor?: string;
  // Image / PDF conversion
  imageFormat?: 'png' | 'jpeg' | 'webp';
  imageScale?: number;
  imageQuality?: number;
  pageSize?: 'fit' | 'A4' | 'Letter';
  marginPt?: number;
  // Text / Markdown / JSON
  rawText?: string;
  // Security
  userPassword?: string;
  ownerPassword?: string;
  password?: string;
  // Metadata
  metaTitle?: string;
  metaAuthor?: string;
  metaSubject?: string;
  metaKeywords?: string;
  metaCreator?: string;
  // Compression / OCR
  compressionMode?: 'standard' | 'rasterize';
  ocrLanguage?: string;
  applyFreemiumWatermark?: boolean;
  onProgress?: (pct: number, status?: string) => void;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'document';
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return rgb(
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0
  );
}

export function parsePageRange(input: string | undefined, totalPages: number): number[] {
  if (!input || !input.trim()) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const result: number[] = [];
  const seen = new Set<number>();
  for (const part of input.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-').map((s) => s.trim());
      const start = Math.max(1, parseInt(startStr, 10) || 1);
      const end = Math.min(totalPages, parseInt(endStr, 10) || totalPages);
      const step = start <= end ? 1 : -1;
      for (let p = start; step > 0 ? p <= end : p >= end; p += step) {
        if (p >= 1 && p <= totalPages && !seen.has(p)) {
          seen.add(p);
          result.push(p);
        }
      }
    } else {
      const p = parseInt(trimmed, 10);
      if (p >= 1 && p <= totalPages && !seen.has(p)) {
        seen.add(p);
        result.push(p);
      }
    }
  }
  return result.length > 0 ? result : Array.from({ length: totalPages }, (_, i) => i + 1);
}

function toRoman(num: number): string {
  const map: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = Math.max(1, num);
  let out = '';
  for (const [val, sym] of map) {
    while (n >= val) {
      out += sym;
      n -= val;
    }
  }
  return out;
}

const PAGE_DIMS: Record<'A4' | 'Letter' | 'A3' | 'Legal', [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  A3: [841.89, 1190.55],
  Legal: [612, 1008],
};

function bytesToBlob(bytes: Uint8Array, mimeType = 'application/pdf'): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: mimeType });
}

async function loadImageAsPngBytes(file: File): Promise<{ bytes: Uint8Array; isJpg: boolean }> {
  if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) {
    return { bytes: new Uint8Array(await file.arrayBuffer()), isJpg: true };
  }
  if (file.type === 'image/png' || /\.png$/i.test(file.name)) {
    return { bytes: new Uint8Array(await file.arrayBuffer()), isJpg: false };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Failed to decode image: ${file.name}`));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, 0, 0);
    const pngBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png')
    );
    return { bytes: new Uint8Array(await pngBlob.arrayBuffer()), isJpg: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function inspectPdfMetadata(file: File): Promise<PdfMetadataInfo> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages().map((page, idx) => {
    const { width, height } = page.getSize();
    return {
      pageNumber: idx + 1,
      widthPt: Math.round(width),
      heightPt: Math.round(height),
      widthIn: (width / 72).toFixed(2),
      heightIn: (height / 72).toFixed(2),
    };
  });
  return {
    title: doc.getTitle() || '',
    author: doc.getAuthor() || '',
    subject: doc.getSubject() || '',
    keywords: doc.getKeywords() || '',
    creator: doc.getCreator() || '',
    producer: doc.getProducer() || '',
    creationDate: doc.getCreationDate()?.toISOString() || '',
    modificationDate: doc.getModificationDate()?.toISOString() || '',
    pageCount: doc.getPageCount(),
    fileSize: file.size,
    pages,
  };
}

export async function stampSaAiWatermark(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const label = 'SA AI';
  const fontSize = 9.5;
  const textWidth = font.widthOfTextAtSize(label, fontSize);

  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    page.drawText(label, {
      x: Math.max(16, width / 2 - textWidth / 2),
      y: 14,
      size: fontSize,
      font,
      color: rgb(0.45, 0.5, 0.58),
      opacity: 0.38,
    });
  }

  return doc.save({ useObjectStreams: true });
}

export async function processTool(
  toolId: string,
  files: File[],
  options: ToolOptions = {}
): Promise<ProcessedResult> {
  const result = await runToolCore(toolId, files, options);
  if (
    options.applyFreemiumWatermark &&
    result.mimeType === 'application/pdf' &&
    toolId !== 'encrypt-pdf'
  ) {
    try {
      const raw = new Uint8Array(await result.blob.arrayBuffer());
      const stamped = await stampSaAiWatermark(raw);
      return {
        ...result,
        blob: bytesToBlob(stamped, 'application/pdf'),
      };
    } catch {
      // Preserve output if PDF stream cannot be re-saved
    }
  }
  return result;
}

async function runToolCore(
  toolId: string,
  files: File[],
  options: ToolOptions = {}
): Promise<ProcessedResult> {
  const progress = options.onProgress || (() => {});
  const primary = files[0];
  const primaryName = primary ? baseName(primary.name) : 'document';

  switch (toolId) {
    case 'merge-pdf': {
      const merged = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        progress(Math.round(((i + 0.5) / files.length) * 85), `Merging ${files[i].name}...`);
        const bytes = new Uint8Array(await files[i].arrayBuffer());
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const out = await merged.save({ useObjectStreams: true });
      progress(100);
      return {
        blob: bytesToBlob(out),
        fileName: `merged-${files.length}-files.pdf`,
        mimeType: 'application/pdf',
        summary: `Merged ${files.length} files (${merged.getPageCount()} total pages).`,
      };
    }

    case 'alternate-merge': {
      const docs = await Promise.all(
        files.map(async (f) => PDFDocument.load(new Uint8Array(await f.arrayBuffer()), { ignoreEncryption: true }))
      );
      const maxPages = Math.max(...docs.map((d) => d.getPageCount()));
      const merged = await PDFDocument.create();
      for (let p = 0; p < maxPages; p++) {
        for (const src of docs) {
          if (p < src.getPageCount()) {
            const [copied] = await merged.copyPages(src, [p]);
            merged.addPage(copied);
          }
        }
      }
      const out = await merged.save({ useObjectStreams: true });
      return {
        blob: bytesToBlob(out),
        fileName: `interleaved-${primaryName}.pdf`,
        mimeType: 'application/pdf',
        summary: `Interleaved ${merged.getPageCount()} pages from ${docs.length} PDFs.`,
      };
    }

    case 'split-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = src.getPageCount();
      const mode = options.splitMode || 'ranges';

      if (mode === 'everyPage') {
        const zip = new JSZip();
        for (let i = 0; i < total; i++) {
          progress(Math.round(((i + 1) / total) * 90), `Splitting page ${i + 1}/${total}`);
          const single = await PDFDocument.create();
          const [p] = await single.copyPages(src, [i]);
          single.addPage(p);
          zip.file(`${primaryName}-page-${i + 1}.pdf`, await single.save());
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        return {
          blob,
          fileName: `${primaryName}-split-pages.zip`,
          mimeType: 'application/zip',
          summary: `Split ${total} pages into individual PDFs.`,
        };
      }

      if (mode === 'evenOdd') {
        const zip = new JSZip();
        const oddDoc = await PDFDocument.create();
        const evenDoc = await PDFDocument.create();
        for (let i = 0; i < total; i++) {
          const target = i % 2 === 0 ? oddDoc : evenDoc;
          const [p] = await target.copyPages(src, [i]);
          target.addPage(p);
        }
        zip.file(`${primaryName}-odd-pages.pdf`, await oddDoc.save());
        if (evenDoc.getPageCount() > 0) {
          zip.file(`${primaryName}-even-pages.pdf`, await evenDoc.save());
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        return {
          blob,
          fileName: `${primaryName}-even-odd.zip`,
          mimeType: 'application/zip',
          summary: `Split into odd (${oddDoc.getPageCount()}) and even (${evenDoc.getPageCount()}) PDFs.`,
        };
      }

      const pagesToKeep = parsePageRange(options.pageRanges, total);
      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(
        src,
        pagesToKeep.map((p) => p - 1)
      );
      copied.forEach((p) => outDoc.addPage(p));
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-split.pdf`,
        mimeType: 'application/pdf',
        summary: `Extracted ${pagesToKeep.length} page(s).`,
      };
    }

    case 'extract-pages': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = src.getPageCount();
      const pagesToKeep =
        options.selectedPages && options.selectedPages.length > 0
          ? options.selectedPages
          : parsePageRange(options.pageRanges, total);
      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(
        src,
        pagesToKeep.filter((p) => p >= 1 && p <= total).map((p) => p - 1)
      );
      copied.forEach((p) => outDoc.addPage(p));
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-extracted.pdf`,
        mimeType: 'application/pdf',
        summary: `Extracted ${outDoc.getPageCount()} page(s).`,
      };
    }

    case 'delete-pages': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = src.getPageCount();
      const toDelete = new Set(
        options.selectedPages && options.selectedPages.length > 0
          ? options.selectedPages
          : options.pageRanges?.trim()
          ? parsePageRange(options.pageRanges, total)
          : []
      );
      const keepIndices = Array.from({ length: total }, (_, i) => i).filter(
        (idx) => !toDelete.has(idx + 1)
      );
      if (keepIndices.length === 0) {
        throw new Error('Cannot delete every page in the PDF.');
      }
      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(src, keepIndices);
      copied.forEach((p) => outDoc.addPage(p));
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-trimmed.pdf`,
        mimeType: 'application/pdf',
        summary: `Removed ${toDelete.size} page(s); ${keepIndices.length} remaining.`,
      };
    }

    case 'organize-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = src.getPageCount();
      const order =
        options.pageOrder && options.pageOrder.length > 0
          ? options.pageOrder
          : Array.from({ length: total }, (_, i) => i + 1);
      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(
        src,
        order.filter((p) => p >= 1 && p <= total).map((p) => p - 1)
      );
      copied.forEach((p) => outDoc.addPage(p));
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-organized.pdf`,
        mimeType: 'application/pdf',
        summary: `Reordered ${outDoc.getPageCount()} pages.`,
      };
    }

    case 'reverse-pages': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const indices = src.getPageIndices().reverse();
      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(src, indices);
      copied.forEach((p) => outDoc.addPage(p));
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-reversed.pdf`,
        mimeType: 'application/pdf',
        summary: `Reversed all ${indices.length} pages.`,
      };
    }

    case 'rotate-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const delta = options.rotationAngle ?? 90;
      const targets = new Set(parsePageRange(options.pageRanges, doc.getPageCount()));
      doc.getPages().forEach((page, idx) => {
        if (targets.has(idx + 1)) {
          const current = page.getRotation().angle;
          page.setRotation(degrees((current + delta) % 360));
        }
      });
      return {
        blob: bytesToBlob(await doc.save()),
        fileName: `${primaryName}-rotated.pdf`,
        mimeType: 'application/pdf',
        summary: `Rotated ${targets.size} page(s) by ${delta}°.`,
      };
    }

    case 'add-blank-page': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const refPage = doc.getPage(0);
      const { width, height } = refPage ? refPage.getSize() : { width: 595.28, height: 841.89 };
      const count = Math.max(1, Math.min(20, options.blankCount || 1));
      const pos = options.blankPosition || 'end';
      const insertAt =
        pos === 'start'
          ? 0
          : pos === 'after'
          ? Math.min(doc.getPageCount(), Math.max(0, options.blankAfterPage || 1))
          : doc.getPageCount();
      for (let i = 0; i < count; i++) {
        doc.insertPage(insertAt + i, [width, height]);
      }
      return {
        blob: bytesToBlob(await doc.save()),
        fileName: `${primaryName}-with-blank.pdf`,
        mimeType: 'application/pdf',
        summary: `Inserted ${count} blank page(s).`,
      };
    }

    case 'n-up-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const n = options.pagesPerSheet || 4;
      const cols = n === 2 ? 2 : n === 4 ? 2 : n === 6 ? 3 : 3;
      const rows = n === 2 ? 1 : n === 4 ? 2 : n === 6 ? 2 : 3;
      const outDoc = await PDFDocument.create();
      const [sheetW, sheetH] = PAGE_DIMS.A4;
      const embedded = await outDoc.embedPages(src.getPages());

      for (let i = 0; i < embedded.length; i += n) {
        const sheet = outDoc.addPage([sheetW, sheetH]);
        const cellW = sheetW / cols;
        const cellH = sheetH / rows;
        for (let j = 0; j < n && i + j < embedded.length; j++) {
          const ep = embedded[i + j];
          const col = j % cols;
          const row = Math.floor(j / cols);
          const scale = Math.min((cellW - 16) / ep.width, (cellH - 16) / ep.height);
          const drawW = ep.width * scale;
          const drawH = ep.height * scale;
          const x = col * cellW + (cellW - drawW) / 2;
          const y = sheetH - (row + 1) * cellH + (cellH - drawH) / 2;
          sheet.drawPage(ep, { x, y, width: drawW, height: drawH });
        }
      }
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-${n}up.pdf`,
        mimeType: 'application/pdf',
        summary: `Arranged ${embedded.length} pages into ${outDoc.getPageCount()} ${n}-up sheet(s).`,
      };
    }

    case 'combine-single-page': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const outDoc = await PDFDocument.create();
      const embedded = await outDoc.embedPages(src.getPages());
      const maxW = Math.max(...embedded.map((p) => p.width));
      const totalH = embedded.reduce((sum, p) => sum + p.height, 0);
      const page = outDoc.addPage([maxW, totalH]);
      let yCursor = totalH;
      for (const ep of embedded) {
        yCursor -= ep.height;
        page.drawPage(ep, { x: (maxW - ep.width) / 2, y: yCursor, width: ep.width, height: ep.height });
      }
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-continuous.pdf`,
        mimeType: 'application/pdf',
        summary: `Combined ${embedded.length} pages into one continuous canvas.`,
      };
    }

    case 'divide-pages': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const outDoc = await PDFDocument.create();
      const axis = options.divideAxis || 'vertical';
      for (const page of src.getPages()) {
        const { width, height } = page.getSize();
        const [p1, p2] = await outDoc.copyPages(src, [src.getPages().indexOf(page), src.getPages().indexOf(page)]);
        if (axis === 'vertical') {
          p1.setCropBox(0, 0, width / 2, height);
          p1.setMediaBox(0, 0, width / 2, height);
          p2.setCropBox(width / 2, 0, width / 2, height);
          p2.setMediaBox(width / 2, 0, width / 2, height);
        } else {
          p1.setCropBox(0, height / 2, width, height / 2);
          p1.setMediaBox(0, height / 2, width, height / 2);
          p2.setCropBox(0, 0, width, height / 2);
          p2.setMediaBox(0, 0, width, height / 2);
        }
        outDoc.addPage(p1);
        outDoc.addPage(p2);
      }
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-divided.pdf`,
        mimeType: 'application/pdf',
        summary: `Divided ${src.getPageCount()} pages into ${outDoc.getPageCount()} halves.`,
      };
    }

    case 'posterize-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const cols = Math.max(1, Math.min(5, options.posterCols || 2));
      const rows = Math.max(1, Math.min(5, options.posterRows || 2));
      const outDoc = await PDFDocument.create();
      const embedded = await outDoc.embedPages(src.getPages());
      for (const ep of embedded) {
        const tileW = ep.width / cols;
        const tileH = ep.height / rows;
        for (let r = rows - 1; r >= 0; r--) {
          for (let c = 0; c < cols; c++) {
            const tile = outDoc.addPage([tileW, tileH]);
            tile.drawPage(ep, {
              x: -c * tileW,
              y: -r * tileH,
              width: ep.width,
              height: ep.height,
            });
          }
        }
      }
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-poster-${cols}x${rows}.pdf`,
        mimeType: 'application/pdf',
        summary: `Tiled into ${outDoc.getPageCount()} printable sheets (${cols}×${rows}).`,
      };
    }

    case 'pdf-booklet': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const origPages = src.getPages();
      const paddedCount = Math.ceil(origPages.length / 4) * 4;
      const outDoc = await PDFDocument.create();
      const embedded = await outDoc.embedPages(origPages);
      const [sheetW, sheetH] = [PAGE_DIMS.A4[1], PAGE_DIMS.A4[0]]; // Landscape A4
      const halfW = sheetW / 2;

      for (let i = 0; i < paddedCount / 2; i++) {
        const sheet = outDoc.addPage([sheetW, sheetH]);
        const leftIdx = i % 2 === 0 ? paddedCount - 1 - i : i;
        const rightIdx = i % 2 === 0 ? i : paddedCount - 1 - i;

        if (leftIdx < embedded.length) {
          const lp = embedded[leftIdx];
          const s = Math.min(halfW / lp.width, sheetH / lp.height);
          sheet.drawPage(lp, {
            x: (halfW - lp.width * s) / 2,
            y: (sheetH - lp.height * s) / 2,
            width: lp.width * s,
            height: lp.height * s,
          });
        }
        if (rightIdx < embedded.length) {
          const rp = embedded[rightIdx];
          const s = Math.min(halfW / rp.width, sheetH / rp.height);
          sheet.drawPage(rp, {
            x: halfW + (halfW - rp.width * s) / 2,
            y: (sheetH - rp.height * s) / 2,
            width: rp.width * s,
            height: rp.height * s,
          });
        }
      }
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-booklet.pdf`,
        mimeType: 'application/pdf',
        summary: `Imposed ${origPages.length} pages into ${outDoc.getPageCount()} booklet spreads.`,
      };
    }

    case 'pdf-to-zip': {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const file of files) {
        let candidate = file.name;
        if (usedNames.has(candidate.toLowerCase())) {
          const extIdx = candidate.lastIndexOf('.');
          const stem = extIdx > -1 ? candidate.slice(0, extIdx) : candidate;
          const ext = extIdx > -1 ? candidate.slice(extIdx) : '';
          let counter = 2;
          while (usedNames.has(`${stem} (${counter})${ext}`.toLowerCase())) {
            counter++;
          }
          candidate = `${stem} (${counter})${ext}`;
        }
        usedNames.add(candidate.toLowerCase());
        zip.file(candidate, await file.arrayBuffer());
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      return {
        blob,
        fileName: `pdfcraft-archive-${files.length}-files.zip`,
        mimeType: 'application/zip',
        summary: `Packaged ${files.length} file(s) into a ZIP archive.`,
      };
    }

    case 'watermark': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const text = options.watermarkText?.trim() || 'CONFIDENTIAL';
      const fontSize = options.watermarkFontSize || 48;
      const color = hexToRgb(options.watermarkColor || '#2563eb');
      const opacity = options.watermarkOpacity ?? 0.25;
      const pos = options.watermarkPosition || 'diagonal';

      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        let x = (width - textWidth) / 2;
        let y = height / 2;
        let rot = 0;

        if (pos === 'diagonal') {
          rot = 45;
          x = width / 2 - (textWidth * Math.cos(Math.PI / 4)) / 2;
          y = height / 2 - (textWidth * Math.sin(Math.PI / 4)) / 2;
        } else if (pos === 'topLeft') {
          x = 36;
          y = height - fontSize - 36;
        } else if (pos === 'topRight') {
          x = Math.max(36, width - textWidth - 36);
          y = height - fontSize - 36;
        } else if (pos === 'bottomLeft') {
          x = 36;
          y = 36;
        } else if (pos === 'bottomRight') {
          x = Math.max(36, width - textWidth - 36);
          y = 36;
        }

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color,
          opacity,
          rotate: degrees(rot),
        });
      }
      return {
        blob: bytesToBlob(await doc.save()),
        fileName: `${primaryName}-watermarked.pdf`,
        mimeType: 'application/pdf',
        summary: `Applied watermark "${text}" to ${doc.getPageCount()} pages.`,
      };
    }

    case 'page-numbers': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const total = pages.length;
      const start = options.startNumber || 1;
      const fmt = options.pageNumberFormat || 'pageOfTotal';
      const pos = options.pageNumberPosition || 'bottomCenter';

      pages.forEach((page, idx) => {
        const { width, height } = page.getSize();
        const n = start + idx;
        const label =
          fmt === 'roman'
            ? toRoman(n)
            : fmt === 'number'
            ? `${n}`
            : `Page ${n} of ${total + start - 1}`;
        const tw = font.widthOfTextAtSize(label, 11);
        const y = pos.startsWith('top') ? height - 28 : 20;
        const x = pos.endsWith('Left')
          ? 32
          : pos.endsWith('Right')
          ? Math.max(32, width - tw - 32)
          : (width - tw) / 2;

        page.drawText(label, {
          x,
          y,
          size: 11,
          font,
          color: rgb(0.25, 0.25, 0.3),
        });
      });

      return {
        blob: bytesToBlob(await doc.save()),
        fileName: `${primaryName}-numbered.pdf`,
        mimeType: 'application/pdf',
        summary: `Added page numbers to ${total} pages.`,
      };
    }

    case 'header-footer': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const total = pages.length;
      const headerTpl = options.headerText || '';
      const footerTpl = options.footerText || 'Page {page} of {total}';

      pages.forEach((page, idx) => {
        const { width, height } = page.getSize();
        const replaceVars = (tpl: string) =>
          tpl
            .replace(/\{page\}/g, String(idx + 1))
            .replace(/\{total\}/g, String(total))
            .replace(/\{date\}/g, new Date().toLocaleDateString());

        if (headerTpl.trim()) {
          const text = replaceVars(headerTpl);
          const tw = font.widthOfTextAtSize(text, 10);
          page.drawText(text, { x: (width - tw) / 2, y: height - 24, size: 10, font, color: rgb(0.3, 0.35, 0.42) });
        }
        if (footerTpl.trim()) {
          const text = replaceVars(footerTpl);
          const tw = font.widthOfTextAtSize(text, 10);
          page.drawText(text, { x: (width - tw) / 2, y: 18, size: 10, font, color: rgb(0.3, 0.35, 0.42) });
        }
      });

      return {
        blob: bytesToBlob(await doc.save()),
        fileName: `${primaryName}-header-footer.pdf`,
        mimeType: 'application/pdf',
        summary: `Applied header & footer to ${total} pages.`,
      };
    }

    case 'crop-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const margin = Math.max(0, options.cropMarginPt ?? 36);
      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();
        const newW = Math.max(72, width - margin * 2);
        const newH = Math.max(72, height - margin * 2);
        page.setCropBox(margin, margin, newW, newH);
        page.setMediaBox(margin, margin, newW, newH);
      }
      return {
        blob: bytesToBlob(await doc.save()),
        fileName: `${primaryName}-cropped.pdf`,
        mimeType: 'application/pdf',
        summary: `Cropped ${margin}pt from every margin across ${doc.getPageCount()} pages.`,
      };
    }

    case 'fix-page-size': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const targetKey = options.targetPageSize || 'A4';
      const [targetW, targetH] = PAGE_DIMS[targetKey];
      const outDoc = await PDFDocument.create();
      const embedded = await outDoc.embedPages(src.getPages());
      for (const ep of embedded) {
        const page = outDoc.addPage([targetW, targetH]);
        const scale = Math.min(targetW / ep.width, targetH / ep.height);
        const drawW = ep.width * scale;
        const drawH = ep.height * scale;
        page.drawPage(ep, {
          x: (targetW - drawW) / 2,
          y: (targetH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-${targetKey.toLowerCase()}.pdf`,
        mimeType: 'application/pdf',
        summary: `Standardized ${embedded.length} pages to ${targetKey}.`,
      };
    }

    case 'background-color': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const outDoc = await PDFDocument.create();
      const bg = hexToRgb(options.backgroundColor || '#fef9c3');
      const embedded = await outDoc.embedPages(src.getPages());
      for (const ep of embedded) {
        const page = outDoc.addPage([ep.width, ep.height]);
        page.drawRectangle({ x: 0, y: 0, width: ep.width, height: ep.height, color: bg });
        page.drawPage(ep, { x: 0, y: 0, width: ep.width, height: ep.height });
      }
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-tinted.pdf`,
        mimeType: 'application/pdf',
        summary: `Applied background tint to ${embedded.length} pages.`,
      };
    }

    case 'invert-colors':
    case 'pdf-to-greyscale':
    case 'rasterize-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const total = await getPdfPageCount(bytes);
      const outDoc = await PDFDocument.create();
      const scale = options.imageScale || 1.75;

      for (let i = 1; i <= total; i++) {
        progress(Math.round((i / total) * 90), `Rendering page ${i}/${total}...`);
        const canvas = await renderPdfPageToCanvas(bytes, i, scale, {
          greyscale: toolId === 'pdf-to-greyscale',
          invert: toolId === 'invert-colors',
        });
        const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const jpgBytes = await (await fetch(jpgDataUrl)).arrayBuffer();
        const img = await outDoc.embedJpg(jpgBytes);
        const page = outDoc.addPage([img.width / scale, img.height / scale]);
        page.drawImage(img, { x: 0, y: 0, width: img.width / scale, height: img.height / scale });
      }

      const suffix =
        toolId === 'invert-colors'
          ? 'inverted'
          : toolId === 'pdf-to-greyscale'
          ? 'greyscale'
          : 'rasterized';
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-${suffix}.pdf`,
        mimeType: 'application/pdf',
        summary: `Processed ${total} pages.`,
      };
    }

    case 'remove-annotations': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const { PDFName } = await import('pdf-lib');
      for (const page of doc.getPages()) {
        page.node.delete(PDFName.of('Annots'));
      }
      return {
        blob: bytesToBlob(await doc.save()),
        fileName: `${primaryName}-no-annotations.pdf`,
        mimeType: 'application/pdf',
        summary: `Removed annotations from ${doc.getPageCount()} pages.`,
      };
    }

    case 'remove-blank-pages': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const pageTexts = await extractPdfTextByPage(bytes);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const keepIndices: number[] = [];

      for (let i = 0; i < pageTexts.length; i++) {
        if (pageTexts[i].text.length > 0) {
          keepIndices.push(i);
        } else {
          // Also check if page contains drawn pixels (images/vector)
          const canvas = await renderPdfPageToCanvas(bytes, i + 1, 0.3);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let hasInk = false;
            for (let p = 0; p < data.length; p += 16) {
              if (data[p] < 248 || data[p + 1] < 248 || data[p + 2] < 248) {
                hasInk = true;
                break;
              }
            }
            if (hasInk) keepIndices.push(i);
          }
        }
      }

      if (keepIndices.length === 0) {
        throw new Error('All pages appear blank.');
      }

      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(doc, keepIndices);
      copied.forEach((p) => outDoc.addPage(p));
      const removed = doc.getPageCount() - keepIndices.length;
      return {
        blob: bytesToBlob(await outDoc.save()),
        fileName: `${primaryName}-cleaned.pdf`,
        mimeType: 'application/pdf',
        summary: `Removed ${removed} blank page(s); ${keepIndices.length} pages kept.`,
      };
    }

    case 'image-to-pdf': {
      const doc = await PDFDocument.create();
      const margin = options.marginPt ?? 24;
      const sizeMode = options.pageSize || 'fit';

      for (let i = 0; i < files.length; i++) {
        progress(Math.round(((i + 0.5) / files.length) * 90), `Embedding ${files[i].name}...`);
        const { bytes, isJpg } = await loadImageAsPngBytes(files[i]);
        const img = isJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);

        if (sizeMode === 'fit') {
          const page = doc.addPage([img.width + margin * 2, img.height + margin * 2]);
          page.drawImage(img, { x: margin, y: margin, width: img.width, height: img.height });
        } else {
          const [pw, ph] = PAGE_DIMS[sizeMode];
          const page = doc.addPage([pw, ph]);
          const availW = pw - margin * 2;
          const availH = ph - margin * 2;
          const scale = Math.min(availW / img.width, availH / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          page.drawImage(img, {
            x: (pw - drawW) / 2,
            y: (ph - drawH) / 2,
            width: drawW,
            height: drawH,
          });
        }
      }

      return {
        blob: bytesToBlob(await doc.save()),
        fileName: `${primaryName}-images.pdf`,
        mimeType: 'application/pdf',
        summary: `Converted ${files.length} image(s) into a PDF.`,
      };
    }

    case 'txt-to-pdf':
    case 'json-to-pdf':
    case 'markdown-to-pdf': {
      let textContent = options.rawText || '';
      if (!textContent && files.length > 0) {
        const parts = await Promise.all(files.map((f) => f.text()));
        textContent = parts.join('\n\n');
      }
      if (toolId === 'json-to-pdf') {
        try {
          textContent = JSON.stringify(JSON.parse(textContent), null, 2);
        } catch {
          // keep raw if invalid json
        }
      } else if (toolId === 'markdown-to-pdf') {
        const html = await marked.parse(textContent);
        const div = document.createElement('div');
        div.innerHTML = html;
        textContent = div.innerText || textContent;
      }

      const doc = await PDFDocument.create();
      const font = await doc.embedFont(
        toolId === 'json-to-pdf' ? StandardFonts.Courier : StandardFonts.Helvetica
      );
      const [pageW, pageH] = PAGE_DIMS.A4;
      const margin = 48;
      const fontSize = toolId === 'json-to-pdf' ? 9.5 : 11;
      const lineHeight = fontSize * 1.45;
      const maxLineWidth = pageW - margin * 2;

      const wrappedLines: string[] = [];
      for (const rawLine of textContent.replace(/\r\n/g, '\n').split('\n')) {
        if (!rawLine) {
          wrappedLines.push('');
          continue;
        }
        let current = '';
        for (const word of rawLine.split(' ')) {
          const candidate = current ? `${current} ${word}` : word;
          if (font.widthOfTextAtSize(candidate, fontSize) <= maxLineWidth) {
            current = candidate;
          } else {
            if (current) wrappedLines.push(current);
            current = word;
          }
        }
        if (current) wrappedLines.push(current);
      }

      let page = doc.addPage([pageW, pageH]);
      let y = pageH - margin;
      for (const line of wrappedLines) {
        if (y < margin + lineHeight) {
          page = doc.addPage([pageW, pageH]);
          y = pageH - margin;
        }
        const safeLine = line.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
        if (safeLine) {
          page.drawText(safeLine, { x: margin, y, size: fontSize, font, color: rgb(0.08, 0.1, 0.14) });
        }
        y -= lineHeight;
      }

      return {
        blob: bytesToBlob(await doc.save()),
        fileName: `${primaryName}.pdf`,
        mimeType: 'application/pdf',
        summary: `Generated ${doc.getPageCount()} PDF page(s).`,
      };
    }

    case 'pdf-to-image':
    case 'extract-images': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const total = await getPdfPageCount(bytes);
      const targets = parsePageRange(options.pageRanges, total);
      const fmt = options.imageFormat || 'png';
      const mime = fmt === 'jpeg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
      const scale = options.imageScale || 2;
      const quality = options.imageQuality ?? 0.92;

      if (targets.length === 1) {
        const canvas = await renderPdfPageToCanvas(bytes, targets[0], scale);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), mime, quality)
        );
        return {
          blob,
          fileName: `${primaryName}-page-${targets[0]}.${fmt === 'jpeg' ? 'jpg' : fmt}`,
          mimeType: mime,
          summary: `Exported page ${targets[0]} as ${fmt.toUpperCase()}.`,
        };
      }

      const zip = new JSZip();
      for (let idx = 0; idx < targets.length; idx++) {
        const p = targets[idx];
        progress(Math.round(((idx + 1) / targets.length) * 90), `Rendering page ${p}/${total}...`);
        const canvas = await renderPdfPageToCanvas(bytes, p, scale);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), mime, quality)
        );
        zip.file(`${primaryName}-page-${p}.${fmt === 'jpeg' ? 'jpg' : fmt}`, blob);
      }
      return {
        blob: await zip.generateAsync({ type: 'blob' }),
        fileName: `${primaryName}-images.zip`,
        mimeType: 'application/zip',
        summary: `Exported ${targets.length} pages as ${fmt.toUpperCase()} in ZIP.`,
      };
    }

    case 'pdf-to-json': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const pages = await extractPdfTextByPage(bytes);
      const meta = await inspectPdfMetadata(primary);
      const payload = JSON.stringify({ fileName: primary.name, metadata: meta, pages }, null, 2);
      return {
        blob: new Blob([payload], { type: 'application/json' }),
        fileName: `${primaryName}.json`,
        mimeType: 'application/json',
        summary: `Extracted ${pages.length} pages to structured JSON.`,
      };
    }

    case 'pdf-to-markdown': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const pages = await extractPdfTextByPage(bytes);
      const md = pages
        .map((p) => `## Page ${p.pageNumber}\n\n${p.text || '_No extractable text on this page._'}`)
        .join('\n\n---\n\n');
      return {
        blob: new Blob([md], { type: 'text/markdown' }),
        fileName: `${primaryName}.md`,
        mimeType: 'text/markdown',
        summary: `Converted ${pages.length} pages to Markdown.`,
      };
    }

    case 'ocr-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const total = await getPdfPageCount(bytes);
      const targets = parsePageRange(options.pageRanges, total);
      const { createWorker } = await import('tesseract.js');
      const lang = options.ocrLanguage || 'eng';
      progress(10, 'Initializing Tesseract OCR...');
      const worker = await createWorker(lang);
      const texts: string[] = [];

      try {
        for (let i = 0; i < targets.length; i++) {
          const p = targets[i];
          progress(15 + Math.round(((i + 0.5) / targets.length) * 80), `Recognizing page ${p}...`);
          const canvas = await renderPdfPageToCanvas(bytes, p, 2);
          const {
            data: { text },
          } = await worker.recognize(canvas);
          texts.push(`--- Page ${p} ---\n${text.trim()}`);
        }
      } finally {
        await worker.terminate();
      }

      return {
        blob: new Blob([texts.join('\n\n')], { type: 'text/plain;charset=utf-8' }),
        fileName: `${primaryName}-ocr.txt`,
        mimeType: 'text/plain',
        summary: `Completed OCR across ${targets.length} page(s).`,
      };
    }

    case 'compress-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      if (options.compressionMode === 'rasterize') {
        const total = await getPdfPageCount(bytes);
        const outDoc = await PDFDocument.create();
        const scale = 1.25;
        for (let i = 1; i <= total; i++) {
          progress(Math.round((i / total) * 90), `Compressing page ${i}/${total}...`);
          const canvas = await renderPdfPageToCanvas(bytes, i, scale);
          const jpgUrl = canvas.toDataURL('image/jpeg', 0.65);
          const jpgBytes = await (await fetch(jpgUrl)).arrayBuffer();
          const img = await outDoc.embedJpg(jpgBytes);
          const page = outDoc.addPage([img.width / scale, img.height / scale]);
          page.drawImage(img, { x: 0, y: 0, width: img.width / scale, height: img.height / scale });
        }
        const out = await outDoc.save({ useObjectStreams: true });
        return {
          blob: bytesToBlob(out),
          fileName: `${primaryName}-compressed.pdf`,
          mimeType: 'application/pdf',
          summary: `Reduced from ${(bytes.length / 1024).toFixed(1)} KB to ${(out.length / 1024).toFixed(1)} KB.`,
        };
      }
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      return {
        blob: bytesToBlob(out),
        fileName: `${primaryName}-compressed.pdf`,
        mimeType: 'application/pdf',
        summary: `Optimized object streams (${(bytes.length / 1024).toFixed(1)} KB → ${(out.length / 1024).toFixed(1)} KB).`,
      };
    }

    case 'edit-metadata': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      if (options.metaTitle !== undefined) doc.setTitle(options.metaTitle);
      if (options.metaAuthor !== undefined) doc.setAuthor(options.metaAuthor);
      if (options.metaSubject !== undefined) doc.setSubject(options.metaSubject);
      if (options.metaKeywords !== undefined) {
        doc.setKeywords(
          options.metaKeywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
        );
      }
      if (options.metaCreator !== undefined) doc.setCreator(options.metaCreator);
      const out = await doc.save();
      return {
        blob: bytesToBlob(out),
        fileName: `${primaryName}-metadata.pdf`,
        mimeType: 'application/pdf',
        summary: 'Updated PDF metadata properties.',
      };
    }

    case 'remove-metadata': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      doc.setTitle('');
      doc.setAuthor('');
      doc.setSubject('');
      doc.setKeywords([]);
      doc.setCreator('');
      doc.setProducer('');
      const out = await doc.save();
      return {
        blob: bytesToBlob(out),
        fileName: `${primaryName}-no-metadata.pdf`,
        mimeType: 'application/pdf',
        summary: 'Stripped document metadata fields.',
      };
    }

    case 'flatten-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      try {
        doc.getForm().flatten();
      } catch {
        // No form fields present
      }
      return {
        blob: bytesToBlob(await doc.save()),
        fileName: `${primaryName}-flattened.pdf`,
        mimeType: 'application/pdf',
        summary: 'Flattened interactive form fields into page content.',
      };
    }

    case 'sanitize-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      try {
        doc.getForm().flatten();
      } catch {}
      const { PDFName } = await import('pdf-lib');
      for (const page of doc.getPages()) {
        page.node.delete(PDFName.of('Annots'));
      }
      doc.setTitle('');
      doc.setAuthor('');
      doc.setSubject('');
      doc.setKeywords([]);
      doc.setCreator('');
      doc.setProducer('');
      return {
        blob: bytesToBlob(await doc.save({ useObjectStreams: true })),
        fileName: `${primaryName}-sanitized.pdf`,
        mimeType: 'application/pdf',
        summary: 'Sanitized metadata, annotations, and form fields.',
      };
    }

    case 'encrypt-pdf': {
      let bytes = new Uint8Array(await primary.arrayBuffer());
      if (options.applyFreemiumWatermark) {
        try {
          bytes = new Uint8Array(await stampSaAiWatermark(bytes));
        } catch {
          // Continue encryption if source cannot be stamped beforehand
        }
      }
      const userPw = options.userPassword || '';
      const ownerPw = options.ownerPassword || userPw;
      if (!userPw && !ownerPw) {
        throw new Error('Please enter a user or owner password.');
      }
      const out = await runQpdf(bytes, (inP, outP) => [
        '--encrypt',
        userPw,
        ownerPw,
        '256',
        '--',
        inP,
        outP,
      ]);
      return {
        blob: bytesToBlob(out),
        fileName: `${primaryName}-encrypted.pdf`,
        mimeType: 'application/pdf',
        summary: 'Encrypted PDF with AES-256 via QPDF WASM.',
      };
    }

    case 'decrypt-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const pw = options.password || '';
      const out = await runQpdf(bytes, (inP, outP) => [
        ...(pw ? [`--password=${pw}`] : []),
        '--decrypt',
        inP,
        outP,
      ]);
      return {
        blob: bytesToBlob(out),
        fileName: `${primaryName}-decrypted.pdf`,
        mimeType: 'application/pdf',
        summary: 'Decrypted PDF locally via QPDF WASM.',
      };
    }

    case 'remove-restrictions': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const out = await runQpdf(bytes, (inP, outP) => ['--decrypt', inP, outP]);
      return {
        blob: bytesToBlob(out),
        fileName: `${primaryName}-unlocked.pdf`,
        mimeType: 'application/pdf',
        summary: 'Cleared owner permission restrictions.',
      };
    }

    case 'linearize-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      const out = await runQpdf(bytes, (inP, outP) => ['--linearize', inP, outP]);
      return {
        blob: bytesToBlob(out),
        fileName: `${primaryName}-linearized.pdf`,
        mimeType: 'application/pdf',
        summary: 'Linearized PDF for fast web byte-serving.',
      };
    }

    case 'repair-pdf': {
      const bytes = new Uint8Array(await primary.arrayBuffer());
      try {
        const out = await runQpdf(bytes, (inP, outP) => [inP, outP]);
        return {
          blob: bytesToBlob(out),
          fileName: `${primaryName}-repaired.pdf`,
          mimeType: 'application/pdf',
          summary: 'Rebuilt PDF xref table and structure via QPDF WASM.',
        };
      } catch {
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        return {
          blob: bytesToBlob(await doc.save()),
          fileName: `${primaryName}-repaired.pdf`,
          mimeType: 'application/pdf',
          summary: 'Rebuilt PDF document structure.',
        };
      }
    }

    default:
      throw new Error(`Unsupported tool operation: ${toolId}`);
  }
}

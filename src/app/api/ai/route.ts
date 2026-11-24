import { GoogleGenAI, type Content, type Part } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { isValidLocale } from '@/lib/i18n/config';
import { TOOLS } from '@/lib/tools/registry';

export const runtime = 'nodejs';

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_DOC_CHARS = 45000;
const ALLOWED_IMAGE_REGEX = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i;
const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

const PLATFORM_TOOLS_CATALOG = TOOLS.map(
  (t) => `- ${t.name} | slug: ${t.slug} | category: ${t.category} | ${t.description}`
).join('\n');

function sanitizeEnv(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^["']+|["']+$/g, '').trim();
}

function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const maybeStatus =
    (err as { status?: unknown; code?: unknown }).status ??
    (err as { code?: unknown }).code;
  if (typeof maybeStatus === 'number') return maybeStatus;
  if (typeof maybeStatus === 'string' && /^\d+$/.test(maybeStatus)) return Number(maybeStatus);
  return undefined;
}

function extractNestedJsonMessage(input: string): string | null {
  const start = input.indexOf('{');
  const end = input.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(input.slice(start, end + 1)) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof parsed?.error === 'object' && parsed.error?.message) {
        return extractNestedJsonMessage(parsed.error.message) || parsed.error.message;
      }
      if (typeof parsed?.error === 'string') {
        return extractNestedJsonMessage(parsed.error) || parsed.error;
      }
      if (typeof parsed?.message === 'string') {
        return parsed.message;
      }
    } catch {
      // Fall through to regex fallback
    }
  }
  const match = input.match(/"message"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const status = getErrorStatus(err);
  const rawMsg = err instanceof Error ? err.message : 'Failed to process AI request.';
  const cleanMsg = extractNestedJsonMessage(rawMsg) || rawMsg;
  const safeStatus = status && status >= 400 && status < 600 ? status : 502;
  return {
    status: safeStatus,
    message: `AI service error (${safeStatus}): ${cleanMsg}`,
  };
}

function shouldFallbackModel(err: unknown): boolean {
  const status = getErrorStatus(err);
  const msg = err instanceof Error ? err.message : String(err);
  return (
    status === 404 ||
    status === 429 ||
    status === 503 ||
    /404|429|503|not[_\s-]?found|unsupported model|resource[_\s-]?exhausted|unavailable|overloaded|rate[_\s-]?limit|quota/i.test(
      msg
    )
  );
}

function buildSystemInstruction(locale: string): string {
  const activeLocale = isValidLocale(locale) ? locale : 'en';
  const languageGuidance =
    activeLocale === 'ar'
      ? 'Respond clearly in Arabic unless the user explicitly asks for another language. Use structured Markdown headings and bullet points when helpful.'
      : 'Respond clearly and concisely in the user’s language using structured Markdown headings and bullet points when helpful.';

  return [
    `You are SA AI, an ultra-fast AI document analyst and smart platform navigator for the SA AI web application.`,
    languageGuidance,
    `The user's active locale prefix is "/${activeLocale}".`,
    ``,
    `### Platform Navigation & Action Links Rules`,
    `When a user asks how to perform a PDF, document, conversion, security, or workflow task:`,
    `1. Briefly explain how the feature works on SA AI (mentioning that PDF tools process files privately right in the user's browser).`,
    `2. Always include a clickable Markdown action link pointing directly to the matching route using the exact "/${activeLocale}" prefix, for example:`,
    activeLocale === 'ar'
      ? `   - لأدوات PDF: [فتح أداة Merge PDF](/${activeLocale}/tools/merge-pdf)`
      : `   - For PDF tools: [Open Merge PDF](/${activeLocale}/tools/merge-pdf)`,
    activeLocale === 'ar'
      ? `   - لبناء سلسلة خطوات: [فتح منشئ سير العمل](/${activeLocale}/workflow)`
      : `   - For multi-step pipelines: [Open Workflow Builder](/${activeLocale}/workflow)`,
    activeLocale === 'ar'
      ? `   - لتصفح كل الأدوات: [تصفح جميع الأدوات](/${activeLocale}/tools)`
      : `   - To browse all tools: [Browse All Tools](/${activeLocale}/tools)`,
    activeLocale === 'ar'
      ? `   - للباقات والنقاط: [عرض الباقات والنقاط](/${activeLocale}/pricing)`
      : `   - For credits & plans: [View Pricing & Credits](/${activeLocale}/pricing)`,
    `3. ONLY use slugs that exist in the SA AI Tool Catalog below. Never invent nonexistent tool slugs. For example, if a user asks for "PDF to Word", explain that SA AI converts PDFs into editable Markdown or extracts scanned text via OCR, and link to \`/${activeLocale}/tools/pdf-to-markdown\` and \`/${activeLocale}/tools/ocr-pdf\`.`,
    `4. If a user asks to summarize a file, analyze an image/PDF, extract data, translate text, or create an exam/quiz, tell them they can do it directly right here in SA AI Studio (/${activeLocale}/ai) by attaching a PDF, TXT, or image with the + button or pasting text—and if they already provided content or a topic, fulfill the request immediately.`,
    ``,
    `### Core App Routes`,
    `- SA AI Studio (Chat, File Analysis, Summarization, Translation, Exam & Quiz Generation): /${activeLocale}/ai`,
    `- All PDF Tools Directory: /${activeLocale}/tools`,
    `- Visual Workflow Builder (Chain multiple PDF tools): /${activeLocale}/workflow`,
    `- Pricing & Credits: /${activeLocale}/pricing`,
    ``,
    `### Complete SA AI PDF Tool Catalog (Route format: /${activeLocale}/tools/{slug})`,
    PLATFORM_TOOLS_CATALOG,
  ].join('\n');
}

async function startStreamWithFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  fallbackModel: string,
  contents: Content[],
  systemInstruction: string
) {
  const openForModel = async (modelName: string) => {
    const stream = await ai.models.generateContentStream({
      model: modelName,
      contents,
      config: {
        systemInstruction,
      },
    });
    const iterator = stream[Symbol.asyncIterator]();
    const first = await iterator.next();
    return { iterator, first, modelName };
  };

  try {
    return await openForModel(primaryModel);
  } catch (primaryErr) {
    if (shouldFallbackModel(primaryErr) && primaryModel !== fallbackModel) {
      return await openForModel(fallbackModel);
    }
    throw primaryErr;
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = sanitizeEnv(process.env.GEMINI_API_KEY);
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in environment secrets.',
        },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      prompt?: string;
      history?: ChatHistoryItem[];
      imageDataUrl?: string | null;
      documentText?: string | null;
      fileName?: string | null;
      locale?: string;
    };

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt && !body.imageDataUrl && !body.documentText) {
      return NextResponse.json(
        { error: 'Please provide a message or attach a file.' },
        { status: 400 }
      );
    }

    let imageInlinePart: Part | null = null;
    if (body.imageDataUrl) {
      const match = body.imageDataUrl.trim().match(ALLOWED_IMAGE_REGEX);
      if (!match) {
        return NextResponse.json(
          { error: 'Unsupported image format. Please use JPG, PNG, or WebP.' },
          { status: 400 }
        );
      }
      const mimeType =
        match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
      imageInlinePart = {
        inlineData: {
          mimeType,
          data: match[2],
        },
      };
    }

    const locale = typeof body.locale === 'string' ? body.locale : 'en';
    const systemInstruction = buildSystemInstruction(locale);

    const historyContents: Content[] = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .filter(
            (m) =>
              m &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string' &&
              m.content.trim().length > 0
          )
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content.slice(0, 8000) }],
          }))
      : [];

    const docContext =
      typeof body.documentText === 'string' && body.documentText.trim().length > 0
        ? `\n\n[Attached File: ${
            typeof body.fileName === 'string' ? body.fileName.slice(0, 120) : 'document'
          }]\n${body.documentText.slice(0, MAX_DOC_CHARS)}`
        : '';

    const combinedText = `${prompt || 'Please analyze the attached content.'}${docContext}`;
    const currentParts: Part[] = [{ text: combinedText }];
    if (imageInlinePart) {
      currentParts.push(imageInlinePart);
    }

    const contents: Content[] = [
      ...historyContents,
      { role: 'user', parts: currentParts },
    ];

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const configuredModel = sanitizeEnv(process.env.GEMINI_MODEL) || PRIMARY_GEMINI_MODEL;
    const { iterator, first, modelName } = await startStreamWithFallback(
      ai,
      configuredModel,
      FALLBACK_GEMINI_MODEL,
      contents,
      systemInstruction
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        let emittedChars = 0;
        try {
          let current = first;
          while (!current.done) {
            const chunkText = current.value?.text;
            if (chunkText) {
              emittedChars += chunkText.length;
              sendEvent({ text: chunkText });
            }
            current = await iterator.next();
          }

          if (emittedChars === 0) {
            sendEvent({ error: 'Empty response from AI model.' });
          } else {
            sendEvent({ done: true, model: modelName });
          }
        } catch (streamErr) {
          const formatted = formatGeminiError(streamErr);
          sendEvent({ error: formatted.message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-AI-Model': modelName,
      },
    });
  } catch (err) {
    console.error('Gemini AI route error:', err);
    const formatted = formatGeminiError(err);
    return NextResponse.json({ error: formatted.message }, { status: formatted.status });
  }
}

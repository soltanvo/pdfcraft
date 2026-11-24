import { GoogleGenAI, type Content, type Part } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_DOC_CHARS = 45000;
const ALLOWED_IMAGE_REGEX = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i;
const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash';

function sanitizeEnv(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^["']+|["']+$/g, '').trim();
}

function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const maybeStatus = (err as { status?: unknown; code?: unknown }).status ?? (err as { code?: unknown }).code;
  if (typeof maybeStatus === 'number') return maybeStatus;
  if (typeof maybeStatus === 'string' && /^\d+$/.test(maybeStatus)) return Number(maybeStatus);
  return undefined;
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
      const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
      imageInlinePart = {
        inlineData: {
          mimeType,
          data: match[2],
        },
      };
    }

    const systemLanguage =
      body.locale === 'ar'
        ? 'Respond clearly in Arabic unless the user explicitly asks for another language. Use structured Markdown headings and bullet points when helpful.'
        : 'Respond clearly and concisely in the user’s language using structured Markdown when helpful.';

    const systemInstruction = `You are SA AI, an expert document, PDF, and visual analysis assistant. ${systemLanguage}`;

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
        ? `\n\n[Attached File: ${typeof body.fileName === 'string' ? body.fileName.slice(0, 120) : 'document'}]\n${body.documentText.slice(0, MAX_DOC_CHARS)}`
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
    let usedModel = configuredModel;
    let response;

    try {
      response = await ai.models.generateContent({
        model: usedModel,
        contents,
        config: {
          systemInstruction,
        },
      });
    } catch (primaryErr) {
      const status = getErrorStatus(primaryErr);
      const errMessage = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      const isModelNotFound =
        status === 404 || /not[_\s-]?found|404|unsupported model/i.test(errMessage);

      if (isModelNotFound && usedModel !== FALLBACK_GEMINI_MODEL) {
        usedModel = FALLBACK_GEMINI_MODEL;
        response = await ai.models.generateContent({
          model: usedModel,
          contents,
          config: {
            systemInstruction,
          },
        });
      } else {
        throw primaryErr;
      }
    }

    const reply = response.text?.trim();
    if (!reply) {
      return NextResponse.json({ error: 'Empty response from AI model.' }, { status: 502 });
    }

    return NextResponse.json({
      reply,
      model: usedModel,
      usage: response.usageMetadata || null,
    });
  } catch (err) {
    console.error('Gemini AI route error:', err);
    const status = getErrorStatus(err);
    const rawMsg = err instanceof Error ? err.message : 'Failed to process AI request.';
    let cleanMsg = rawMsg;
    try {
      const parsed = JSON.parse(rawMsg) as { error?: { message?: string } };
      if (parsed?.error?.message) {
        cleanMsg = parsed.error.message;
      }
    } catch {
      // Non-JSON error message; keep rawMsg
    }
    const safeStatus = status && status >= 400 && status < 600 ? status : 502;
    return NextResponse.json(
      { error: `AI service error (${safeStatus}): ${cleanMsg}` },
      { status: safeStatus }
    );
  }
}

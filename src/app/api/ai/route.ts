import { NextRequest, NextResponse } from 'next/server';

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_DOC_CHARS = 45000;
const ALLOWED_IMAGE_PREFIX = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'OPENROUTER_API_KEY is not configured on the server. Add OPENROUTER_API_KEY in environment secrets.',
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

    if (body.imageDataUrl && !ALLOWED_IMAGE_PREFIX.test(body.imageDataUrl)) {
      return NextResponse.json(
        { error: 'Unsupported image format. Please use JPG, PNG, or WebP.' },
        { status: 400 }
      );
    }

    const systemLanguage =
      body.locale === 'ar'
        ? 'Respond clearly in Arabic unless the user explicitly asks for another language. Use structured Markdown headings and bullet points when helpful.'
        : 'Respond clearly and concisely in the user’s language using structured Markdown when helpful.';

    const systemMessage = {
      role: 'system' as const,
      content: `You are SA AI, an expert document, PDF, and visual analysis assistant. ${systemLanguage}`,
    };

    const historyMessages = Array.isArray(body.history)
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
            role: m.role,
            content: m.content.slice(0, 8000),
          }))
      : [];

    const docContext =
      typeof body.documentText === 'string' && body.documentText.trim().length > 0
        ? `\n\n[Attached File: ${typeof body.fileName === 'string' ? body.fileName.slice(0, 120) : 'document'}]\n${body.documentText.slice(0, MAX_DOC_CHARS)}`
        : '';

    const combinedText = `${prompt || 'Please analyze the attached content.'}${docContext}`;

    const userMessageContent = body.imageDataUrl
      ? [
          { type: 'text' as const, text: combinedText },
          { type: 'image_url' as const, image_url: { url: body.imageDataUrl } },
        ]
      : combinedText;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://sa-ai.app',
        'X-Title': 'SA AI Platform',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          systemMessage,
          ...historyMessages,
          { role: 'user', content: userMessageContent },
        ],
        temperature: 0.4,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('OpenRouter error:', response.status, errText);
      return NextResponse.json(
        { error: `AI service error (${response.status}). Please try again.` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: unknown;
    };

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json({ error: 'Empty response from AI model.' }, { status: 502 });
    }

    return NextResponse.json({
      reply,
      model: data.model || 'google/gemini-2.0-flash-001',
      usage: data.usage || null,
    });
  } catch (err) {
    console.error('AI route exception:', err);
    return NextResponse.json({ error: 'Failed to process AI request.' }, { status: 500 });
  }
}

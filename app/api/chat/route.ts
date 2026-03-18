import { NextRequest, NextResponse } from 'next/server';
import { chatAboutCode } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { question, code, apiKey } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "question" field' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "code" field — select a file first' },
        { status: 400 }
      );
    }

    if (code.length > 50000) {
      return NextResponse.json(
        { error: 'Code exceeds maximum length of 50,000 characters' },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'Gemini API key is required. Please set it in the top right corner.' },
        { status: 401 }
      );
    }

    const answer = await chatAboutCode(question, code, apiKey);
    return NextResponse.json({ answer });
  } catch (error: unknown) {
    console.error('Chat API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

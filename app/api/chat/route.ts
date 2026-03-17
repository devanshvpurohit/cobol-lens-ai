import { NextRequest, NextResponse } from 'next/server';
import { chatAboutCode } from '@/lib/openai';

export async function POST(req: NextRequest) {
  try {
    const { question, code } = await req.json();

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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Set OPENAI_API_KEY in environment variables.' },
        { status: 500 }
      );
    }

    const answer = await chatAboutCode(question, code);
    return NextResponse.json({ answer });
  } catch (error: unknown) {
    console.error('Chat API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

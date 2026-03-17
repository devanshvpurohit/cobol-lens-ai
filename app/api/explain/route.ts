import { NextRequest, NextResponse } from 'next/server';
import { explainCode } from '@/lib/openai';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "code" field' },
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

    const explanation = await explainCode(code);
    return NextResponse.json({ explanation });
  } catch (error: unknown) {
    console.error('Explain API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

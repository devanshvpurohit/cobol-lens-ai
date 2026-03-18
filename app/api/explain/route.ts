import { NextRequest, NextResponse } from 'next/server';
import { explainCode } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { code, apiKey } = await req.json();

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

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'Gemini API key is required. Please set it in the top right corner.' },
        { status: 401 }
      );
    }

    const explanation = await explainCode(code, apiKey);
    return NextResponse.json({ explanation });
  } catch (error: unknown) {
    console.error('Explain API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

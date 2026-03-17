import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }
  return openaiClient;
}

export async function explainCode(cobolCode: string): Promise<string> {
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a COBOL expert. Explain COBOL code in simple, clear English. Focus on the business logic and what the program does, not the syntax details. Use bullet points and short paragraphs. Be concise but thorough.',
      },
      {
        role: 'user',
        content: `Explain this COBOL code in simple English. Focus on business logic:\n\n${cobolCode}`,
      },
    ],
    max_tokens: 1000,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || 'Unable to generate explanation.';
}

export async function chatAboutCode(
  question: string,
  cobolCode: string
): Promise<string> {
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a COBOL expert assistant. Answer questions about the provided COBOL code clearly and concisely. If the question is unrelated to the code, politely redirect the user.',
      },
      {
        role: 'user',
        content: `Here is the COBOL code:\n\n${cobolCode}\n\nQuestion: ${question}`,
      },
    ],
    max_tokens: 800,
    temperature: 0.4,
  });

  return response.choices[0]?.message?.content || 'Unable to generate a response.';
}

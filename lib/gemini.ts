import { GoogleGenAI } from '@google/genai';

export async function explainCode(cobolCode: string, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'You are a COBOL expert. Explain COBOL code in simple, clear English. Focus on the business logic and what the program does, not the syntax details. Use bullet points and short paragraphs. Be concise but thorough.\n\nExplain this COBOL code in simple English. Focus on business logic:\n\n' + cobolCode }
        ]
      }
    ],
    config: {
      temperature: 0.3,
      maxOutputTokens: 1000,
    }
  });

  return response.text || 'Unable to generate explanation.';
}

export async function chatAboutCode(
  question: string,
  cobolCode: string,
  apiKey: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'You are a COBOL expert assistant. Answer questions about the provided COBOL code clearly and concisely. If the question is unrelated to the code, politely redirect the user.\n\nHere is the COBOL code:\n\n' + cobolCode + '\n\nQuestion: ' + question }
        ]
      }
    ],
    config: {
      temperature: 0.4,
      maxOutputTokens: 800,
    }
  });

  return response.text || 'Unable to generate a response.';
}

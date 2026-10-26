import { LlmProvider } from './llm-provider.interface.js';
import { postToProvider } from './provider-request.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiLlmProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  generate(prompt: string): Promise<string> {
    return postToProvider(
      'GeminiLlmProvider',
      `${API}/${this.model}:generateContent`,
      // The key goes in a header, never in the URL, so it cannot end up in logs
      { 'x-goog-api-key': this.apiKey },
      { contents: [{ parts: [{ text: prompt }] }] },
      async (response) => {
        const body = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = (body.candidates?.[0]?.content?.parts ?? [])
          .map((part) => part.text ?? '')
          .join('')
          .trim();
        if (!text) throw new Error('the answer has no text');
        return text;
      },
    );
  }
}

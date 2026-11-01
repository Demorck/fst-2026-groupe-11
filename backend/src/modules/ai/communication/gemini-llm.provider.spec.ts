import { BadGatewayException } from '@nestjs/common';
import { GeminiLlmProvider } from './gemini-llm.provider.js';

const provider = () => new GeminiLlmProvider('secret-key', 'text-m');

const answer = (parts: object[]) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts } }] }));

const stubFetch = (response: Response | Error) => {
  const fetch = vi.fn();
  if (response instanceof Error) fetch.mockRejectedValue(response);
  else fetch.mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

afterEach(() => vi.unstubAllGlobals());

describe('GeminiLlmProvider', () => {
  it('sends the prompt to the text model with the key in a header', async () => {
    const fetch = stubFetch(
      answer([{ text: 'Bonjour ' }, { text: 'le monde' }]),
    );

    expect(await provider().generate('Dis bonjour')).toBe('Bonjour le monde');

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/text-m:generateContent',
    );
    expect(url).not.toContain('secret-key');
    expect(init.headers['x-goog-api-key']).toBe('secret-key');
    expect(JSON.parse(init.body).contents[0].parts[0].text).toBe('Dis bonjour');
  });

  it.each([
    [
      'an answer that is not JSON',
      () => stubFetch(new Response('<html>oops</html>')),
    ],
    ['an HTTP error', () => stubFetch(new Response('quota', { status: 429 }))],
    ['a network failure', () => stubFetch(new Error('offline'))],
    ['an answer without text', () => stubFetch(answer([]))],
  ])('hides %s behind a bad gateway error', async (_label, arrange) => {
    arrange();

    await expect(provider().generate('x')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('never leaks the provider message or the key to the client', async () => {
    stubFetch(new Response('key secret-key is invalid', { status: 400 }));

    const error = await provider()
      .generate('x')
      .catch((err: BadGatewayException) => err);

    expect(
      JSON.stringify((error as BadGatewayException).getResponse()),
    ).not.toContain('secret-key');
  });
});

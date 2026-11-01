import { ConfigService } from '@nestjs/config';
import { CloudflareImageProvider } from './cloudflare-image.provider.js';
import { GeminiLlmProvider } from './gemini-llm.provider.js';
import {
  createImageProvider,
  createLlmProvider,
} from './llm-provider.factory.js';
import { MockImageProvider } from './mock-image.provider.js';
import { MockLlmProvider } from './mock-llm.provider.js';

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('createLlmProvider', () => {
  it('uses the mock by default', () => {
    expect(createLlmProvider(config({}))).toBeInstanceOf(MockLlmProvider);
    expect(createLlmProvider(config({ LLM_PROVIDER: 'mock' }))).toBeInstanceOf(
      MockLlmProvider,
    );
  });

  it('uses Gemini when it is selected and a key is set', () => {
    const provider = createLlmProvider(
      config({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' }),
    );

    expect(provider).toBeInstanceOf(GeminiLlmProvider);
  });

  it('falls back on the mock when Gemini is selected without a key', () => {
    const provider = createLlmProvider(
      config({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: '' }),
    );

    expect(provider).toBeInstanceOf(MockLlmProvider);
  });

  it('answers without any network call with the mock', async () => {
    expect(await new MockLlmProvider().generate('Une soirée')).toBe(
      '[mock] Une soirée',
    );
  });
});

describe('createImageProvider', () => {
  it('uses the mock by default, which answers a PNG without network', async () => {
    const provider = createImageProvider(config({}));

    expect(provider).toBeInstanceOf(MockImageProvider);
    expect((await provider.generateImage('x')).mimeType).toBe('image/png');
  });

  it('uses Cloudflare when it is selected with an account and a token', () => {
    const provider = createImageProvider(
      config({
        IMAGE_PROVIDER: 'cloudflare',
        CLOUDFLARE_ACCOUNT_ID: 'a',
        CLOUDFLARE_API_TOKEN: 't',
      }),
    );

    expect(provider).toBeInstanceOf(CloudflareImageProvider);
  });

  it.each([
    [{ CLOUDFLARE_ACCOUNT_ID: '', CLOUDFLARE_API_TOKEN: 't' }],
    [{ CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: '' }],
  ])('falls back on the mock when a Cloudflare value is missing', (values) => {
    const provider = createImageProvider(
      config({ IMAGE_PROVIDER: 'cloudflare', ...values }),
    );

    expect(provider).toBeInstanceOf(MockImageProvider);
  });
});

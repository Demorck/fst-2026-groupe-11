import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudflareImageProvider } from './cloudflare-image.provider.js';
import { GeminiLlmProvider } from './gemini-llm.provider.js';
import { ImageProvider } from './image-provider.interface.js';
import { LlmProvider } from './llm-provider.interface.js';
import { MockImageProvider } from './mock-image.provider.js';
import { MockLlmProvider } from './mock-llm.provider.js';

// Model ids change often: it can be overridden from the environment without touching the code
const DEFAULT_TEXT_MODEL = 'gemini-3.5-flash-lite';

const warnFallback = (message: string) =>
  new Logger('AiProviders').warn(`${message}: using the mock`);

/** `LLM_PROVIDER=gemini` with a key, otherwise the mock (CI, demo without a key). */
export function createLlmProvider(config: ConfigService): LlmProvider {
  if (config.get('LLM_PROVIDER') !== 'gemini') return new MockLlmProvider();

  const apiKey = config.get<string>('GEMINI_API_KEY');
  if (!apiKey) {
    warnFallback('LLM_PROVIDER=gemini but GEMINI_API_KEY is empty');
    return new MockLlmProvider();
  }
  return new GeminiLlmProvider(
    apiKey,
    config.get('GEMINI_TEXT_MODEL') || DEFAULT_TEXT_MODEL,
  );
}

/** `IMAGE_PROVIDER=cloudflare` with an account and a token, otherwise the mock. */
export function createImageProvider(config: ConfigService): ImageProvider {
  if (config.get('IMAGE_PROVIDER') !== 'cloudflare') {
    return new MockImageProvider();
  }

  const accountId = config.get<string>('CLOUDFLARE_ACCOUNT_ID');
  const apiToken = config.get<string>('CLOUDFLARE_API_TOKEN');
  if (!accountId || !apiToken) {
    warnFallback(
      'IMAGE_PROVIDER=cloudflare but CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is empty',
    );
    return new MockImageProvider();
  }
  return new CloudflareImageProvider(accountId, apiToken);
}

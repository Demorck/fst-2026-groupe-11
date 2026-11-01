import { GeneratedImage, ImageProvider } from './image-provider.interface.js';
import { postToProvider } from './provider-request.js';

const MODEL = '@cf/bytedance/stable-diffusion-xl-lightning';
// Poster portrait in the ISO A ratio (1:1.414, A4 to A0). 832x1176 is about 1 megapixel, the size SDXL is
// trained on, so it stays sharp; the model caps each side at 2048. Printing larger needs an upscale.
const POSTER_SIZE = { width: 832, height: 1176 };
// Image models write garbled text on posters: ask the model to leave the text to the layout
const NEGATIVE_PROMPT = 'text, letters, words, watermark, signature, logo';

// A JSON answer does not say the format: read it from the first bytes (base64 of the magic number)
const mimeTypeOf = (base64: string) =>
  base64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';

export class CloudflareImageProvider implements ImageProvider {
  constructor(
    private readonly accountId: string,
    private readonly apiToken: string,
  ) {}

  generateImage(prompt: string): Promise<GeneratedImage> {
    return postToProvider(
      'CloudflareImageProvider',
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${MODEL}`,
      { authorization: `Bearer ${this.apiToken}` },
      { prompt, negative_prompt: NEGATIVE_PROMPT, ...POSTER_SIZE },
      async (response) => {
        // Image models answer either the raw image or a JSON envelope with a base64 image
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.startsWith('image/')) {
          return {
            mimeType: contentType.split(';')[0],
            data: Buffer.from(await response.arrayBuffer()).toString('base64'),
          };
        }
        const body = (await response.json()) as {
          result?: { image?: string };
        };
        const data = body.result?.image;
        if (!data) throw new Error('the answer has no image');
        return { mimeType: mimeTypeOf(data), data };
      },
    );
  }
}

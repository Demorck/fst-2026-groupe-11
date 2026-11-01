import { BadGatewayException } from '@nestjs/common';
import { CloudflareImageProvider } from './cloudflare-image.provider.js';

const provider = () => new CloudflareImageProvider('acc1', 'secret-token');

const answer = (result: object) =>
  new Response(JSON.stringify({ result, success: true }));

const stubFetch = (response: Response | Error) => {
  const fetch = vi.fn();
  if (response instanceof Error) fetch.mockRejectedValue(response);
  else fetch.mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

afterEach(() => vi.unstubAllGlobals());

describe('CloudflareImageProvider', () => {
  it('asks SDXL Lightning for a poster-sized image, with the token in a header', async () => {
    const fetch = stubFetch(answer({ image: '/9j/4AAQ' }));

    expect(await provider().generateImage('Une affiche')).toEqual({
      mimeType: 'image/jpeg',
      data: '/9j/4AAQ',
    });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acc1/ai/run/@cf/bytedance/stable-diffusion-xl-lightning',
    );
    expect(init.headers.authorization).toBe('Bearer secret-token');
    const body = JSON.parse(init.body);
    expect(body.prompt).toBe('Une affiche');
    // ISO A ratio (1:1.414), within the 2048 pixels the model accepts
    expect(body.height / body.width).toBeCloseTo(Math.SQRT2, 2);
    expect(Math.max(body.width, body.height)).toBeLessThanOrEqual(2048);
    expect(body.negative_prompt).toContain('text');
  });

  it('returns the raw image when the model answers the image itself', async () => {
    stubFetch(
      new Response(Buffer.from([1, 2, 3]), {
        headers: { 'content-type': 'image/png' },
      }),
    );

    expect(await provider().generateImage('x')).toEqual({
      mimeType: 'image/png',
      data: 'AQID',
    });
  });

  it('recognizes a PNG from its first bytes in a JSON answer', async () => {
    stubFetch(answer({ image: 'iVBORw0KGgo' }));

    expect((await provider().generateImage('x')).mimeType).toBe('image/png');
  });

  it.each([
    [
      'an answer that is not JSON',
      () => stubFetch(new Response('<html>oops</html>')),
    ],
    ['an HTTP error', () => stubFetch(new Response('denied', { status: 403 }))],
    ['a network failure', () => stubFetch(new Error('offline'))],
    ['an answer without image', () => stubFetch(answer({}))],
  ])('hides %s behind a bad gateway error', async (_label, arrange) => {
    arrange();

    await expect(provider().generateImage('x')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('never leaks the provider message or the token to the client', async () => {
    stubFetch(new Response('token secret-token is invalid', { status: 401 }));

    const error = await provider()
      .generateImage('x')
      .catch((err: BadGatewayException) => err);

    expect(
      JSON.stringify((error as BadGatewayException).getResponse()),
    ).not.toContain('secret-token');
  });
});

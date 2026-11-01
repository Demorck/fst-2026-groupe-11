import { BadGatewayException, Logger } from '@nestjs/common';

const TIMEOUT_MS = 30_000;

/**
 * POSTs JSON to an AI provider and reads the answer. Any failure (network, timeout, HTTP error, unreadable
 * or empty answer) stays in the logs: the client only learns that the provider failed.
 */
export async function postToProvider<T>(
  provider: string,
  url: string,
  headers: Record<string, string>,
  body: object,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${await response.text()}`);
    }
    return await read(response);
  } catch (err) {
    new Logger(provider).error(
      `${provider} request failed: ${(err as Error).message}`,
    );
    throw new BadGatewayException('The AI provider did not answer');
  }
}

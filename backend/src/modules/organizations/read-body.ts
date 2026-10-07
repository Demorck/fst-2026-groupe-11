import { PayloadTooLargeException } from '@nestjs/common';
import type { Request } from 'express';

/** Reads a raw request body, refusing it as soon as it goes over `limit` bytes. */
export async function readBody(req: Request, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limit) {
      throw new PayloadTooLargeException(`Body is over ${limit} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

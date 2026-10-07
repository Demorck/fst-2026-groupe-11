import { detectImageType } from './image-type.js';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('detectImageType', () => {
  it('recognizes png, jpeg and webp from their signature', () => {
    expect(
      detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)),
    ).toBe('image/png');
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(
      detectImageType(
        bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50),
      ),
    ).toBe('image/webp');
  });

  it('rejects svg, html and empty content', () => {
    const text = (value: string) => new TextEncoder().encode(value);

    expect(detectImageType(text('<svg onload="alert(1)"/>'))).toBeNull();
    expect(detectImageType(text('<html></html>'))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

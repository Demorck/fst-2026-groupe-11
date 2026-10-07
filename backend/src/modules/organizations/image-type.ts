export const LOGO_MAX_BYTES = 512 * 1024;

export type ImageType = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * Detects the image type from its first bytes. The client's Content-Type is not trusted: the logo is
 * served back from our own origin, so only raster formats are accepted (no SVG, which can carry scripts).
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const starts = (signature: number[], offset = 0) =>
    signature.every((byte, i) => bytes[offset + i] === byte);

  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  // RIFF....WEBP
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  return null;
}

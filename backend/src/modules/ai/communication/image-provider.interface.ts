export const IMAGE_PROVIDER = Symbol('IMAGE_PROVIDER');

export interface GeneratedImage {
  mimeType: string;
  /** Base64, ready for a data URL */
  data: string;
}

export interface ImageProvider {
  generateImage(prompt: string): Promise<GeneratedImage>;
}

import { Injectable } from '@nestjs/common';
import { GeneratedImage, ImageProvider } from './image-provider.interface.js';

// A 1x1 PNG: enough for the UI and the tests to handle an image without any network call
const PLACEHOLDER_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4tHTpfwAHQAMLZ8lSpgAAAABJRU5ErkJggg==';

@Injectable()
export class MockImageProvider implements ImageProvider {
  generateImage(): Promise<GeneratedImage> {
    return Promise.resolve({ mimeType: 'image/png', data: PLACEHOLDER_PNG });
  }
}

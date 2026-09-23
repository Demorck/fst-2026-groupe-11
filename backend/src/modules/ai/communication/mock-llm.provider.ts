import { Injectable } from '@nestjs/common';
import { LlmProvider } from './llm-provider.interface.js';

@Injectable()
export class MockLlmProvider implements LlmProvider {
  generate(prompt: string): Promise<string> {
    return Promise.resolve(`[mock] ${prompt.slice(0, 80)}`);
  }
}

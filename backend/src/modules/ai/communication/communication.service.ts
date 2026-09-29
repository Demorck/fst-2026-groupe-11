import { Inject, Injectable } from '@nestjs/common';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.interface.js';

@Injectable()
export class CommunicationService {
  constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider) {}
}

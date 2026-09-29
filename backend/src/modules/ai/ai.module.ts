import { Module } from '@nestjs/common';
import { CommunicationService } from './communication/communication.service.js';
import { LLM_PROVIDER } from './communication/llm-provider.interface.js';
import { MockLlmProvider } from './communication/mock-llm.provider.js';
import { PredictionService } from './prediction/prediction.service.js';

@Module({
  providers: [
    PredictionService,
    CommunicationService,
    { provide: LLM_PROVIDER, useClass: MockLlmProvider },
  ],
  exports: [PredictionService, CommunicationService],
})
export class AiModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller.js';
import { CommunicationService } from './communication/communication.service.js';
import { LLM_PROVIDER } from './communication/llm-provider.interface.js';
import { IMAGE_PROVIDER } from './communication/image-provider.interface.js';
import {
  createImageProvider,
  createLlmProvider,
} from './communication/llm-provider.factory.js';
import { PredictionService } from './prediction/prediction.service.js';

@Module({
  controllers: [AiController],
  providers: [
    PredictionService,
    CommunicationService,
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: createLlmProvider,
    },
    {
      provide: IMAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: createImageProvider,
    },
  ],
  exports: [PredictionService, CommunicationService],
})
export class AiModule {}

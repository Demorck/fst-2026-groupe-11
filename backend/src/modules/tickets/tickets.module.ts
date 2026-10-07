import { Module } from '@nestjs/common';
import { MyTicketsController } from './my-tickets.controller.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  controllers: [TicketsController, MyTicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}

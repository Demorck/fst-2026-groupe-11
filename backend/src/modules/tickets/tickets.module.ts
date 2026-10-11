import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { MyTicketsController } from './my-tickets.controller.js';
import { CheckinController, TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [TicketsController, MyTicketsController, CheckinController],
  providers: [TicketsService],
})
export class TicketsModule {}

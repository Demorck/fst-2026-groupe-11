import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}

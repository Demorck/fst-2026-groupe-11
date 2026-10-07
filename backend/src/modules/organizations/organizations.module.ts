import { Module } from '@nestjs/common';
import { EventVolunteersController } from './event-volunteers.controller.js';
import {
  PublicOrganizationController,
  OrganizationsController,
} from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';

@Module({
  controllers: [
    OrganizationsController,
    PublicOrganizationController,
    EventVolunteersController,
  ],
  providers: [OrganizationsService],
  // Events and shifts ask it who manages an event and who may volunteer
  exports: [OrganizationsService],
})
export class OrganizationsModule {}

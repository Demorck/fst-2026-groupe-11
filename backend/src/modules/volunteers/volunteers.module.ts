import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { VolunteersController } from './volunteers.controller.js';
import { VolunteersService } from './volunteers.service.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [VolunteersController],
  providers: [VolunteersService],
})
export class VolunteersModule {}

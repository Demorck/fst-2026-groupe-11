import { Module } from '@nestjs/common';
import { VolunteersController } from './volunteers.controller.js';
import { VolunteersService } from './volunteers.service.js';

@Module({
  controllers: [VolunteersController],
  providers: [VolunteersService],
})
export class VolunteersModule {}

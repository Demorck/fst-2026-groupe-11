import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  type AuthUser,
  JwtAuthGuard,
} from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Role } from '../../generated/prisma/enums.js';
import { TicketsService } from './tickets.service.js';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('events/:eventId/tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PARTICIPANT)
  reserve(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.reserve(eventId, user.id);
  }
}

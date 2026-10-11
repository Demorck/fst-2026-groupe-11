import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';
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

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() { search }: ListTicketsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.listForEvent(eventId, user.id, search);
  }
}

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class CheckinController {
  constructor(private readonly tickets: TicketsService) {}

  @Post(':id/checkin')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.checkIn(id, user.id);
  }
}

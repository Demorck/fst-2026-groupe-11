import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { Roles } from '@/common/decorators/roles.decorator.js';
import { type AuthUser, JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '@/common/guards/roles.guard.js';
import { Role } from '@/generated/prisma/enums.js';
import { CreateShiftDto } from './dto/create-shift.dto.js';
import { UpdateShiftDto } from './dto/update-shift.dto.js';
import { VolunteersService } from './volunteers.service.js';

@ApiTags('volunteers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Non connecté' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class VolunteersController {
  constructor(private readonly volunteers: VolunteersService) {}

  @Get('events/:eventId/shifts')
  @Roles(Role.VOLUNTEER, Role.ORGANIZER)
  @ApiForbiddenResponse({
    description: 'Réservé aux bénévoles et organisateurs',
  })
  @ApiNotFoundResponse({ description: 'Événement introuvable' })
  list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.volunteers.listShifts(eventId, user.id);
  }

  @Post('events/:eventId/shifts')
  @Roles(Role.ORGANIZER)
  @ApiForbiddenResponse({
    description: "Réservé à l'organisateur de l'événement",
  })
  @ApiCreatedResponse({ description: 'Créneau créé' })
  @ApiBadRequestResponse({ description: 'Données invalides' })
  @ApiNotFoundResponse({ description: 'Événement introuvable' })
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateShiftDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.volunteers.createShift(eventId, dto, user.id);
  }

  @Post('shifts/:id/assignments')
  @Roles(Role.VOLUNTEER)
  @ApiCreatedResponse({ description: 'Inscription enregistrée' })
  @ApiForbiddenResponse({ description: 'Réservé aux bénévoles' })
  @ApiNotFoundResponse({ description: 'Créneau introuvable' })
  @ApiConflictResponse({
    description: 'Créneau complet, déjà inscrit ou chevauchement',
  })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.volunteers.assign(id, user.id);
  }

  @Patch('shifts/:id')
  @Roles(Role.ORGANIZER)
  @ApiForbiddenResponse({
    description: "Réservé à l'organisateur de l'événement",
  })
  @ApiBadRequestResponse({ description: 'Données invalides' })
  @ApiNotFoundResponse({ description: 'Créneau introuvable' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.volunteers.updateShift(id, dto, user.id);
  }

  @Delete('shifts/:id')
  @Roles(Role.ORGANIZER)
  @ApiForbiddenResponse({
    description: "Réservé à l'organisateur de l'événement",
  })
  @HttpCode(204)
  @ApiNotFoundResponse({ description: 'Créneau introuvable' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.volunteers.removeShift(id, user.id);
  }
}

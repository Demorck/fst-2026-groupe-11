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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { Roles } from '@/common/decorators/roles.decorator.js';
import { type AuthUser, JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '@/common/guards/roles.guard.js';
import { Role } from '@/generated/prisma/enums.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { EventsService } from './events.service.js';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Événement créé' })
  @ApiBadRequestResponse({ description: 'Données invalides' })
  @ApiUnauthorizedResponse({ description: 'Non connecté' })
  @ApiForbiddenResponse({ description: 'Réservé aux organisateurs' })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthUser) {
    return this.events.create(dto, user.id);
  }

  // Public; a token, when sent, adds the volunteer status of the caller on each event
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Événements triés par date de début, avec leurs organisations et, pour un bénévole connecté, son statut (ASSIGNED ou AVAILABLE)',
  })
  @ApiBadRequestResponse({ description: 'Filtres invalides' })
  findAll(
    @Query() query: ListEventsQueryDto,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.events.findAll(query, user);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Détail de l'événement, avec ses organisations",
  })
  @ApiNotFoundResponse({ description: 'Événement introuvable' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser | undefined) {
    return this.events.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Événement modifié' })
  @ApiBadRequestResponse({ description: 'Données invalides' })
  @ApiForbiddenResponse({
    description: "Pas gestionnaire d'une organisation concernée",
  })
  @ApiNotFoundResponse({ description: 'Événement introuvable' })
  @ApiConflictResponse({
    description:
      'Capacité sous le nombre de billets réservés, ou organisation retirée dont des membres sont sur un créneau',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.events.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Événement supprimé' })
  @ApiForbiddenResponse({
    description: "Pas gestionnaire d'une organisation de l'événement",
  })
  @ApiNotFoundResponse({ description: 'Événement introuvable' })
  @ApiConflictResponse({
    description: 'Des billets sont réservés ou des bénévoles inscrits',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.events.remove(id, user.id);
  }
}

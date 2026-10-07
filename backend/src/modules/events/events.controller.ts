import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
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
}

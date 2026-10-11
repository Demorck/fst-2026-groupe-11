import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { Roles } from '@/common/decorators/roles.decorator.js';
import { type AuthUser, JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '@/common/guards/roles.guard.js';
import { Role } from '@/generated/prisma/enums.js';
import { OrganizationsService } from './organizations.service.js';

@ApiTags('organizations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Non connecté' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@Controller('events/:eventId/volunteers')
export class EventVolunteersController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Delete(':volunteerId')
  @ApiOkResponse({
    description: 'Participation supprimée (nombre de créneaux retirés)',
  })
  @ApiForbiddenResponse({
    description:
      "Le bénévole (ou co-gestionnaire, pour le gestionnaire principal) n'est pas dans une organisation que vous gérez et qui organise l'événement",
  })
  @ApiNotFoundResponse({
    description: 'Événement introuvable ou bénévole non inscrit',
  })
  removeParticipation(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('volunteerId', ParseUUIDPipe) volunteerId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.removeVolunteerParticipation(
      user.id,
      eventId,
      volunteerId,
    );
  }
}

import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { Roles } from '@/common/decorators/roles.decorator.js';
import { type AuthUser, JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '@/common/guards/roles.guard.js';
import { Role } from '@/generated/prisma/enums.js';
import { CommunicationService } from './communication/communication.service.js';
import {
  CommunicationResponseDto,
  GenerateCommunicationDto,
} from './dto/communication.dto.js';
import {
  AttendancePredictionDto,
  AttendancePredictionResponseDto,
} from './dto/attendance-prediction.dto.js';
import { PredictionService } from './prediction/prediction.service.js';

@ApiTags('ai')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Non connecté' })
@ApiForbiddenResponse({
  description:
    "Réservé aux organisateurs (et aux gestionnaires de l'événement pour la communication)",
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@Controller('ai')
export class AiController {
  constructor(
    private readonly prediction: PredictionService,
    private readonly communication: CommunicationService,
  ) {}

  // 200 and not 201: nothing is created, the history is only read
  @Post('attendance-prediction')
  @HttpCode(200)
  @ApiOperation({
    summary: "Prédit l'affluence d'un événement à partir de l'historique",
  })
  @ApiOkResponse({ type: AttendancePredictionResponseDto })
  attendancePrediction(@Body() dto: AttendancePredictionDto) {
    return this.prediction.predict(dto);
  }

  // 200: the drafts are only returned, the event changes when the manager saves an edited version
  @Post('communication')
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Rédige la description marketing et un post réseau social d'un événement (gestionnaires de l'événement)",
  })
  @ApiOkResponse({ type: CommunicationResponseDto })
  @ApiNotFoundResponse({ description: 'Événement inconnu' })
  @ApiBadGatewayResponse({ description: "Le fournisseur d'IA n'a pas répondu" })
  generateCommunication(
    @Body() dto: GenerateCommunicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communication.generate(dto.eventId, user.id);
  }
}

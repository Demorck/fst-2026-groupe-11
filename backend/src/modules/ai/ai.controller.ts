import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '@/common/guards/roles.guard.js';
import { Role } from '@/generated/prisma/enums.js';
import {
  AttendancePredictionDto,
  AttendancePredictionResponseDto,
} from './dto/attendance-prediction.dto.js';
import { PredictionService } from './prediction/prediction.service.js';

@ApiTags('ai')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Non connecté' })
@ApiForbiddenResponse({ description: 'Réservé aux organisateurs' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@Controller('ai')
export class AiController {
  constructor(private readonly prediction: PredictionService) {}

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
}

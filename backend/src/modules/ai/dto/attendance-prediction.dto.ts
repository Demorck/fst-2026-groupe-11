import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, Min } from 'class-validator';
import { EventCategory } from '@/generated/prisma/enums.js';

export class AttendancePredictionDto {
  @ApiProperty({ enum: EventCategory })
  @IsEnum(EventCategory)
  category: EventCategory;

  @ApiProperty({ description: "Début de l'événement (donne la saison)" })
  @Type(() => Date)
  @IsDate()
  startsAt: Date;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) capacity: number;
}

export class AttendanceWarningDto {
  @ApiProperty({ enum: ['OVERBOOKING_RISK', 'UNDERBOOKING_RISK'] })
  type: 'OVERBOOKING_RISK' | 'UNDERBOOKING_RISK';

  @ApiProperty() message: string;
}

export class AttendancePredictionResponseDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Billets attendus (réservations non annulées), null sans historique',
  })
  estimate: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Taux de remplissage attendu, entre 0 et 1',
  })
  fillRate: number | null;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';

  @ApiProperty({
    description:
      "Nombre d'événements passés de la même catégorie (les autres catégories stabilisent seulement l'estimation)",
  })
  sampleSize: number;

  @ApiProperty({ type: AttendanceWarningDto, nullable: true })
  warning: AttendanceWarningDto | null;
}

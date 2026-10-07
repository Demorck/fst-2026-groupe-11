import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Seulement les événements de cette organisation (dont vous êtes gestionnaire)',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

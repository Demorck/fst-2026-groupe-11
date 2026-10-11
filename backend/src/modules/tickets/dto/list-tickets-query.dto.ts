import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListTicketsQueryDto {
  @ApiPropertyOptional({ description: 'Nom du participant ou code du billet' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

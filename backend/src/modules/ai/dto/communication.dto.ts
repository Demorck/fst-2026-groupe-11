import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GenerateCommunicationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() eventId: string;
}

export class CommunicationResponseDto {
  @ApiProperty({
    description: "Description marketing de l'événement, à relire et modifier",
  })
  description: string;

  @ApiProperty({ description: 'Post pour les réseaux sociaux' })
  post: string;
}

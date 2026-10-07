import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
} from 'class-validator';
import { EventCategory } from '@/generated/prisma/enums.js';

export class CreateEventDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsString() @IsNotEmpty() description: string;
  @ApiProperty() @Type(() => Date) @IsDate() startsAt: Date;
  @ApiProperty() @Type(() => Date) @IsDate() endsAt: Date;
  @ApiProperty() @IsString() @IsNotEmpty() location: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) capacity: number;
  @ApiProperty({ enum: EventCategory })
  @IsEnum(EventCategory)
  category: EventCategory;
  @ApiPropertyOptional() @IsOptional() @IsUrl() imageUrl?: string;
  @ApiProperty({
    type: [String],
    minItems: 1,
    description:
      "Organisations qui gèrent l'événement (dont l'auteur est gestionnaire)",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  organizationIds: string[];
}

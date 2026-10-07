import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateShiftDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @Type(() => Date) @IsDate() startsAt: Date;
  @ApiProperty() @Type(() => Date) @IsDate() endsAt: Date;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) requiredVolunteers: number;
}

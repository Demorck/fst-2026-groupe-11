import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsInt()
  @Min(1)
  JWT_EXPIRES_IN_SECONDS: number;

  @IsOptional()
  @IsIn(['mock', 'gemini'])
  LLM_PROVIDER?: string;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  @IsOptional()
  @IsString()
  GEMINI_TEXT_MODEL?: string;

  @IsOptional()
  @IsIn(['mock', 'cloudflare'])
  IMAGE_PROVIDER?: string;

  @IsOptional()
  @IsString()
  CLOUDFLARE_ACCOUNT_ID?: string;

  @IsOptional()
  @IsString()
  CLOUDFLARE_API_TOKEN?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated);
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validated;
}

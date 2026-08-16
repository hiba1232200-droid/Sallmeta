import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  assistantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  persona?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  fallbackMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(64)
  @Max(4000)
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  allowOrderCreation?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  handoffKeywords?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

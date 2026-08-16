import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { KnowledgeCategory } from '@prisma/client';

export class CreateKnowledgeDto {
  @IsEnum(KnowledgeCategory)
  category!: KnowledgeCategory;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(8000)
  content!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

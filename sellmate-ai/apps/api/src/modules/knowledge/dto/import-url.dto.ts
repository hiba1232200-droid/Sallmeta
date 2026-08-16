import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { KnowledgeCategory } from '@prisma/client';

/** استيراد محتوى صفحة ويب إلى قاعدة المعرفة (يجلبه الخادم ويحوّله نصًّا). */
export class ImportUrlDto {
  @IsString()
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsEnum(KnowledgeCategory)
  category?: KnowledgeCategory;
}

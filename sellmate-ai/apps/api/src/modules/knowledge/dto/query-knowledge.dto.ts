import { IsEnum, IsOptional } from 'class-validator';
import { KnowledgeCategory } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryKnowledgeDto extends PaginationDto {
  @IsOptional()
  @IsEnum(KnowledgeCategory)
  category?: KnowledgeCategory;
}

import { IsEnum, IsOptional } from 'class-validator';
import { ConversationStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryConversationsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;
}

import { Controller, Get, Param, Query, VERSION_NEUTRAL } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { ConversationsService } from '../conversations/conversations.service';
import { QueryConversationsDto } from '../conversations/dto/query-conversations.dto';

/** واجهة REST العامة للمحادثات — /api/conversations (قراءة فقط). */
@Controller({ path: 'conversations', version: VERSION_NEUTRAL })
export class ConversationsPublicController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryConversationsDto) {
    return this.conversations.findAll(merchantId, query);
  }

  @Get(':id')
  findOne(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.conversations.findOne(merchantId, id);
  }
}

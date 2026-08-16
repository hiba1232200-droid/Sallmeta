import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { ConversationsService } from './conversations.service';
import { QueryConversationsDto } from './dto/query-conversations.dto';
import { UpdateConversationStatusDto } from './dto/update-status.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryConversationsDto) {
    return this.conversations.findAll(merchantId, query);
  }

  @Get(':id')
  findOne(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.conversations.findOne(merchantId, id);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentMerchantId() merchantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConversationStatusDto,
  ) {
    return this.conversations.setStatus(merchantId, id, dto.status);
  }
}

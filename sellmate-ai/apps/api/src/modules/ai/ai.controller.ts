import { Body, Controller, Post } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { SalesAgentService } from './sales-agent.service';
import { PreviewDto } from './dto/preview.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly agent: SalesAgentService) {}

  /** معاينة المساعد من لوحة التحكم دون تيليجرام (لا يُنشئ طلبات ولا يُحتسب في الاستخدام). */
  @Post('preview')
  async preview(@CurrentMerchantId() merchantId: string, @Body() dto: PreviewDto) {
    const result = await this.agent.process(
      { merchantId, userText: dto.message, allowOrderCreationOverride: false },
      { meter: false },
    );
    return {
      reply: result.reply,
      disabled: result.disabled,
      handoff: result.handoff,
      validated: result.validated,
      toolTrace: result.toolTrace,
    };
  }
}

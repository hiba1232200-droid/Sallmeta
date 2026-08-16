import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { TelegramService } from '../telegram/telegram.service';

/**
 * واجهة REST العامة لويبهوك تيليجرام — /api/webhooks/telegram.
 * يُمرَّر معرّف المتجر عبر ?merchantId=، والسرّ عبر ترويسة x-telegram-bot-api-secret-token.
 */
@Controller({ path: 'webhooks', version: VERSION_NEUTRAL })
export class WebhooksPublicController {
  constructor(private readonly telegram: TelegramService) {}

  @Public()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @Post('telegram')
  async telegramWebhook(
    @Query('merchantId') merchantId: string,
    @Headers('x-telegram-bot-api-secret-token') secret: string,
    @Body() update: Record<string, any>,
  ) {
    await this.telegram.handleUpdate(merchantId, secret, update);
    return { ok: true };
  }
}

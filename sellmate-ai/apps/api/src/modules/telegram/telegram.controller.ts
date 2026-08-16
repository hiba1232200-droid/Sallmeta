import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta, ReqMetaValue } from '../../common/decorators/req-meta.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.constants';
import { TelegramService } from './telegram.service';
import { AgentReplyDto } from './dto/agent-reply.dto';
import { ConfigureBotDto } from './dto/configure-bot.dto';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly audit: AuditService,
  ) {}

  /** نقطة استقبال تحديثات تيليجرام (عامة، محميّة بسرّ الـ webhook داخل الخدمة). */
  @Public()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @Post('webhook/:merchantId')
  async webhook(
    @Param('merchantId') merchantId: string,
    @Headers('x-telegram-bot-api-secret-token') secret: string,
    @Body() update: Record<string, any>,
  ) {
    await this.telegram.handleUpdate(merchantId, secret, update);
    return { ok: true };
  }

  // ------------------------ إدارة من لوحة التحكم ------------------------

  @Get('config')
  getConfig(@CurrentMerchantId() merchantId: string) {
    return this.telegram.getConfig(merchantId);
  }

  @Put('config')
  @Roles('OWNER', 'ADMIN')
  async configure(
    @CurrentMerchantId() merchantId: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: ConfigureBotDto,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const result = await this.telegram.configure(merchantId, dto);
    // ملاحظة: لا نُسجّل رمز البوت إطلاقًا في التدقيق (سرّ حسّاس).
    await this.audit.record({
      action: AuditAction.BOT_CONFIGURE,
      merchantId,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Bot',
      targetId: merchantId,
      ...rm,
    });
    return result;
  }

  @Post('activate')
  @Roles('OWNER', 'ADMIN')
  activate(@CurrentMerchantId() merchantId: string) {
    return this.telegram.setActive(merchantId, true);
  }

  @Post('deactivate')
  @Roles('OWNER', 'ADMIN')
  deactivate(@CurrentMerchantId() merchantId: string) {
    return this.telegram.setActive(merchantId, false);
  }

  @Delete('config')
  @Roles('OWNER')
  async remove(
    @CurrentMerchantId() merchantId: string,
    @CurrentUser() actor: AuthUser,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const result = await this.telegram.remove(merchantId);
    await this.audit.record({
      action: AuditAction.BOT_DELETE,
      merchantId,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Bot',
      targetId: merchantId,
      ...rm,
    });
    return result;
  }

  /** يرسل صاحب المتجر ردًّا للعميل داخل المحادثة (بعد Take Over). */
  @Post('reply')
  @Roles('OWNER', 'ADMIN', 'STAFF')
  reply(@CurrentMerchantId() merchantId: string, @Body() dto: AgentReplyDto) {
    return this.telegram.sendAgentReply(merchantId, dto.conversationId, dto.message);
  }
}

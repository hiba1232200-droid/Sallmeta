import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

/** موجز إشعارات صاحب المتجر — محصور بنطاق المتجر. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryNotificationsDto) {
    return this.notifications.list(merchantId, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentMerchantId() merchantId: string) {
    // فرصة لتشغيل الفحوص الزمنية (اشتراك/استخدام) بمنع تكرار — لا نُعطّل الاستجابة.
    void this.notifications.runChecks(merchantId).catch(() => undefined);
    return this.notifications.unreadCount(merchantId);
  }

  @Patch(':id/read')
  markRead(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.notifications.markRead(merchantId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentMerchantId() merchantId: string) {
    return this.notifications.markAllRead(merchantId);
  }

  /** تشغيل الفحوص الزمنية يدويًا/بالجدولة (اشتراك قارب الانتهاء، استخدام قارب الحد). */
  @Post('run-checks')
  @Roles('OWNER', 'ADMIN')
  async runChecks(@CurrentMerchantId() merchantId: string) {
    await this.notifications.runChecks(merchantId);
    return { ok: true };
  }
}

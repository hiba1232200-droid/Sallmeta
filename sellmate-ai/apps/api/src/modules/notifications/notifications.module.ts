import { Module } from '@nestjs/common';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { TelegramNotifier } from './telegram-notifier.service';

/**
 * وحدة الإشعارات — قائمة بذاتها (Prisma عام + خدمة التشفير كمزوّد محلي)،
 * لا تستورد أي وحدة أخرى، فيمكن للمنتجين (Orders/Customers/…) استيرادها دون تبعية دائرية.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, TelegramNotifier, EncryptionService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

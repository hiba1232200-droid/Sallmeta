import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';

/** وحدة لوحة المشرف الأعلى — تعتمد على SubscriptionsModule لتغيير الخطط/الاشتراكات. */
@Module({
  imports: [SubscriptionsModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}

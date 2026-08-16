import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { UsageService } from './usage.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlansController } from './plans.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [SubscriptionsController, PlansController],
  providers: [PlansService, SubscriptionsService, UsageService],
  exports: [PlansService, SubscriptionsService, UsageService],
})
export class SubscriptionsModule {}

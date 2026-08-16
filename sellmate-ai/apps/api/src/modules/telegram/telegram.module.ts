import { Module } from '@nestjs/common';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { CustomersModule } from '../customers/customers.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TelegramController } from './telegram.controller';
import { TelegramDispatcher } from './telegram.dispatcher';
import { TelegramService } from './telegram.service';

@Module({
  imports: [
    AiModule,
    CustomersModule,
    ConversationsModule,
    MerchantsModule,
    SubscriptionsModule,
    ProductsModule,
    OrdersModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramDispatcher, EncryptionService],
  exports: [TelegramService],
})
export class TelegramModule {}

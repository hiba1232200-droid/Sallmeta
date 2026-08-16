import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { CustomersModule } from '../customers/customers.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PaymentsModule } from '../payments/payments.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AuthPublicController } from './auth-public.controller';
import { ProductsPublicController } from './products-public.controller';
import { OrdersPublicController } from './orders-public.controller';
import { CustomersPublicController } from './customers-public.controller';
import { ConversationsPublicController } from './conversations-public.controller';
import { AnalyticsPublicController } from './analytics-public.controller';
import { SubscriptionPublicController } from './subscription-public.controller';
import { WebhooksPublicController } from './webhooks-public.controller';
import { DocsController } from './docs.controller';

/**
 * واجهة REST العامة الموثّقة على مسارات /api/... (بلا نسخة، VERSION_NEUTRAL)
 * تفوّض إلى خدمات الوحدات القائمة. الواجهة الداخلية /api/v1/... تبقى كما هي للتطبيقات.
 */
@Module({
  imports: [
    AuthModule,
    ProductsModule,
    OrdersModule,
    CustomersModule,
    ConversationsModule,
    AnalyticsModule,
    SubscriptionsModule,
    PaymentsModule,
    TelegramModule,
  ],
  controllers: [
    AuthPublicController,
    ProductsPublicController,
    OrdersPublicController,
    CustomersPublicController,
    ConversationsPublicController,
    AnalyticsPublicController,
    SubscriptionPublicController,
    WebhooksPublicController,
    DocsController,
  ],
})
export class PublicApiModule {}

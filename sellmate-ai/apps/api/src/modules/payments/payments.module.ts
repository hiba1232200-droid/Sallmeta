import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER_TOKEN, PaymentProvider } from './payment.types';
import { NullPaymentProvider } from './providers/null-payment.provider';
import { StripePaymentProvider } from './providers/stripe.provider';

/** اختيار مزوّد الدفع عبر PAYMENT_PROVIDER — بلا ربط hard-coded. */
const paymentProvider = {
  provide: PAYMENT_PROVIDER_TOKEN,
  inject: [ConfigService],
  useFactory: (config: ConfigService): PaymentProvider => {
    const provider = config.get<string>('payments.provider');
    if (provider === 'stripe') {
      return new StripePaymentProvider(
        config.get<string>('payments.stripe.secretKey')!,
        config.get<string>('payments.stripe.webhookSecret') ?? '',
      );
    }
    return new NullPaymentProvider();
  },
};

@Module({
  imports: [SubscriptionsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, paymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}

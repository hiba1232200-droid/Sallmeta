import { CheckoutSession, PaymentProvider, PaymentWebhookEvent } from '../payment.types';

/** مزوّد افتراضي عند PAYMENT_PROVIDER=none — يرفض العمليات برسالة واضحة. */
export class NullPaymentProvider implements PaymentProvider {
  readonly name = 'none';

  async createCheckoutSession(): Promise<CheckoutSession> {
    throw new Error('لم يُهيّأ مزوّد دفع. اضبط PAYMENT_PROVIDER وبيانات اعتماده.');
  }

  async verifyAndParseWebhook(): Promise<PaymentWebhookEvent> {
    throw new Error('لا مزوّد دفع مُهيّأ.');
  }
}

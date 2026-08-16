import {
  CheckoutSession,
  CheckoutSessionInput,
  PaymentProvider,
  PaymentWebhookEvent,
} from '../payment.types';

/**
 * مزوّد Stripe. التحميل كسول عبر require حتى لا يرتبط البناء بوجود الحزمة.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly stripe: any;

  constructor(secretKey: string, private readonly webhookSecret: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe');
    const Ctor = Stripe.default ?? Stripe;
    this.stripe = new Ctor(secretKey);
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: input.customerEmail,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { merchantId: input.merchantId, planTier: input.planTier },
      subscription_data: {
        metadata: { merchantId: input.merchantId, planTier: input.planTier },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            product_data: { name: input.productName },
            unit_amount: input.amount,
            recurring: { interval: input.interval },
          },
        },
      ],
    });
    return { id: session.id, url: session.url ?? null };
  }

  async verifyAndParseWebhook(
    payload: Buffer | string,
    signature: string,
  ): Promise<PaymentWebhookEvent> {
    const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    return { type: event.type, data: event.data?.object };
  }
}

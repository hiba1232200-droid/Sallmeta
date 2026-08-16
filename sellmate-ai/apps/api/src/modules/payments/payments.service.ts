import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlansService } from '../subscriptions/plans.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PAYMENT_PROVIDER_TOKEN, PaymentProvider } from './payment.types';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_PROVIDER_TOKEN) private readonly provider: PaymentProvider,
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly subscriptions: SubscriptionsService,
    private readonly config: ConfigService,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  /** ينشئ جلسة دفع اشتراك لخطة معيّنة. */
  async createSubscriptionCheckout(merchantId: string, tier: PlanTier) {
    const plan = await this.plans.getByTier(tier);
    const appUrl = this.config.get<string>('app.url');
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { email: true },
    });

    return this.provider.createCheckoutSession({
      merchantId,
      planTier: tier,
      productName: `SellMate AI — ${plan.name}`,
      amount: Math.round(Number(plan.priceMonthly) * 100),
      currency: plan.currency.toLowerCase(),
      interval: 'month',
      customerEmail: merchant?.email ?? undefined,
      successUrl: `${appUrl}/settings?checkout=success`,
      cancelUrl: `${appUrl}/settings?checkout=cancel`,
    });
  }

  /** يستقبل أحداث المزوّد ويُفعّل الخطة عند اكتمال الدفع. */
  async handleWebhook(payload: Buffer | string, signature: string) {
    const event = await this.provider.verifyAndParseWebhook(payload, signature);

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.created'
    ) {
      const metadata = event.data?.metadata ?? {};
      if (metadata.merchantId && metadata.planTier) {
        const tier = metadata.planTier as PlanTier;
        await this.subscriptions.changePlan(metadata.merchantId, tier).catch(() => undefined);
        // نُسجّل الدفعة للعرض في لوحة المشرف (أفضل جهد — لا يُفشل الـ webhook).
        await this.recordPayment(metadata.merchantId, tier, event.data).catch(() => undefined);
      }
    }

    return { received: true, type: event.type };
  }

  /** يسجّل دفعة ناجحة في سجلّ المدفوعات. */
  private async recordPayment(
    merchantId: string,
    tier: PlanTier,
    data: Record<string, any> | undefined,
  ): Promise<void> {
    const plan = await this.plans.getByTier(tier);
    await this.prisma.payment.create({
      data: {
        merchantId,
        amount: plan.priceMonthly,
        currency: plan.currency,
        status: 'PAID',
        provider: this.provider.name,
        planTier: tier,
        externalId: (data?.id as string) ?? (data?.subscription as string) ?? null,
      },
    });
  }
}

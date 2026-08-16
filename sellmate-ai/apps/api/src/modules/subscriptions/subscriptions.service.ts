import { ForbiddenException, Injectable } from '@nestjs/common';
import { Plan, PlanTier, Subscription } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays } from '../../common/utils/date.util';
import { PlansService } from './plans.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  /** يجلب اشتراك المتجر مع خطته، وينشئ اشتراكًا مجانيًا افتراضيًا إن لم يوجد. */
  async getForMerchant(merchantId: string): Promise<{ subscription: Subscription; plan: Plan }> {
    const existing = await this.prisma.subscription.findUnique({
      where: { merchantId },
      include: { plan: true },
    });
    if (existing) {
      return { subscription: existing, plan: existing.plan };
    }
    const free = await this.plans.getByTier('FREE');
    const created = await this.prisma.subscription.create({
      data: {
        merchantId,
        planId: free.id,
        status: 'ACTIVE',
        currentPeriodEnd: addDays(new Date(), 30),
      },
      include: { plan: true },
    });
    return { subscription: created, plan: created.plan };
  }

  /** يغيّر خطة المتجر (يُستخدم لاحقًا مع بوابة الدفع). */
  async changePlan(merchantId: string, tier: PlanTier): Promise<{ subscription: Subscription; plan: Plan }> {
    const plan = await this.plans.getByTier(tier);
    const subscription = await this.prisma.subscription.upsert({
      where: { merchantId },
      update: { planId: plan.id, status: 'ACTIVE', cancelAtPeriodEnd: false },
      create: {
        merchantId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: addDays(new Date(), 30),
      },
    });
    return { subscription, plan };
  }

  /** يلغي التجديد التلقائي: يبقى الوصول حتى نهاية الفترة الحالية ثم يتوقّف. */
  async cancel(merchantId: string): Promise<{ subscription: Subscription; plan: Plan }> {
    const { plan } = await this.getForMerchant(merchantId);
    const subscription = await this.prisma.subscription.update({
      where: { merchantId },
      data: { cancelAtPeriodEnd: true },
    });
    return { subscription, plan };
  }

  /** هل الاشتراك فعّال؟ (غير منتهٍ وغير ملغى/متعثّر). */
  isActive(subscription: Subscription): boolean {
    if (
      subscription.status === 'CANCELLED' ||
      subscription.status === 'EXPIRED' ||
      subscription.status === 'PAST_DUE'
    ) {
      return false;
    }
    return subscription.currentPeriodEnd.getTime() >= Date.now();
  }

  /**
   * الخطة الفعلية: عند انتهاء/إلغاء الاشتراك يُعامَل المتجر كخطة مجانية —
   * تُوقَف الميزات المدفوعة دون حذف أي بيانات، ويبقى بإمكانه الترقية.
   */
  async getEffectivePlan(merchantId: string): Promise<Plan> {
    const { subscription, plan } = await this.getForMerchant(merchantId);
    return this.isActive(subscription) ? plan : this.plans.getByTier('FREE');
  }

  async hasFeature(merchantId: string, feature: string): Promise<boolean> {
    const plan = await this.getEffectivePlan(merchantId);
    const features = (plan.features ?? {}) as Record<string, unknown>;
    return features[feature] === true;
  }

  async assertFeature(merchantId: string, feature: string, label?: string): Promise<void> {
    if (!(await this.hasFeature(merchantId, feature))) {
      throw new ForbiddenException(
        `ميزة «${label ?? feature}» غير متاحة في خطتك الحالية. يرجى ترقية الاشتراك.`,
      );
    }
  }

  toPublic(subscription: Subscription, plan: Plan) {
    return {
      status: subscription.status,
      active: this.isActive(subscription),
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      plan: {
        tier: plan.tier,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        currency: plan.currency,
        monthlyMessageLimit: plan.monthlyMessageLimit,
        productLimit: plan.productLimit,
        staffLimit: plan.staffLimit,
        features: plan.features,
      },
    };
  }
}

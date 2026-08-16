import { ForbiddenException } from '@nestjs/common';
import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
import { createPrismaMock, PrismaMock } from '../helpers/prisma.mock';
import { makePlan, makeSubscription } from '../helpers/factories';

/**
 * الاشتراك المنتهي لا يستطيع استخدام الميزات المدفوعة.
 * عند الانتهاء تُرجع getEffectivePlan خطة FREE (دون حذف بيانات)، فتُرفض الميزات المدفوعة.
 */
describe('Expired subscription cannot use premium features', () => {
  let prisma: PrismaMock;
  let plans: any;
  let service: SubscriptionsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    plans = { getByTier: jest.fn().mockResolvedValue(makePlan({ tier: 'FREE', features: { basicDashboard: true } })) };
    service = new SubscriptionsService(prisma as any, plans);
  });

  it('blocks a premium feature when the paid subscription has expired', async () => {
    // اشتراك احترافي لكنه منتهي الصلاحية
    prisma.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ status: 'ACTIVE', currentPeriodEnd: new Date('2000-01-01') }),
      plan: makePlan({ tier: 'PRO', features: { analytics: true, advancedAnalytics: true } }),
    });

    await expect(service.assertFeature('store-A', 'analytics', 'التحليلات')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(plans.getByTier).toHaveBeenCalledWith('FREE');
  });

  it('still allows the same feature while the subscription is active', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ status: 'ACTIVE', currentPeriodEnd: new Date('2999-01-01') }),
      plan: makePlan({ tier: 'PRO', features: { analytics: true } }),
    });
    await expect(service.assertFeature('store-A', 'analytics', 'التحليلات')).resolves.toBeUndefined();
  });

  it('a cancelled subscription is treated as inactive → premium blocked', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ status: 'CANCELLED' }),
      plan: makePlan({ tier: 'PRO', features: { analytics: true } }),
    });
    expect(await service.hasFeature('store-A', 'analytics')).toBe(false);
  });
});

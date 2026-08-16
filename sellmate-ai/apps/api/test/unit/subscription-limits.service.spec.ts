import { ForbiddenException } from '@nestjs/common';
import { UsageService } from '../../src/modules/subscriptions/usage.service';
import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
import { createPrismaMock, PrismaMock } from '../helpers/prisma.mock';
import { makePlan, makeSubscription } from '../helpers/factories';

describe('UsageService (Subscription limits)', () => {
  let prisma: PrismaMock;
  let subscriptions: any;
  let notifications: any;
  let usage: UsageService;

  beforeEach(() => {
    prisma = createPrismaMock();
    subscriptions = { getEffectivePlan: jest.fn() };
    notifications = { checkUsageNear: jest.fn().mockResolvedValue(undefined) };
    usage = new UsageService(prisma as any, subscriptions, notifications);
  });

  it('allows unlimited plans (limit = -1) without counting', async () => {
    subscriptions.getEffectivePlan.mockResolvedValue(makePlan({ monthlyMessageLimit: -1 }));
    await expect(usage.assertWithinMessageLimit('store-A')).resolves.toBeUndefined();
  });

  it('throws when the monthly message limit is reached', async () => {
    subscriptions.getEffectivePlan.mockResolvedValue(makePlan({ monthlyMessageLimit: 100 }));
    prisma.usageRecord.findUnique.mockResolvedValue({ count: 100 });
    await expect(usage.assertWithinMessageLimit('store-A')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows messages below the limit', async () => {
    subscriptions.getEffectivePlan.mockResolvedValue(makePlan({ monthlyMessageLimit: 100 }));
    prisma.usageRecord.findUnique.mockResolvedValue({ count: 42 });
    await expect(usage.assertWithinMessageLimit('store-A')).resolves.toBeUndefined();
  });

  it('enforces the product limit', async () => {
    subscriptions.getEffectivePlan.mockResolvedValue(makePlan({ productLimit: 50 }));
    prisma.product.count.mockResolvedValue(50);
    await expect(usage.assertWithinProductLimit('store-A')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces the staff/team limit', async () => {
    subscriptions.getEffectivePlan.mockResolvedValue(makePlan({ staffLimit: 1 }));
    prisma.user.count.mockResolvedValue(1);
    await expect(usage.assertWithinStaffLimit('store-A')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('increments usage and triggers a near-limit check for AI messages', async () => {
    prisma.usageRecord.upsert.mockResolvedValue({});
    await usage.increment('store-A', 'AI_MESSAGE' as any);
    expect(prisma.usageRecord.upsert).toHaveBeenCalled();
    expect(notifications.checkUsageNear).toHaveBeenCalledWith('store-A');
  });
});

describe('SubscriptionsService (effective plan / expiry)', () => {
  let prisma: PrismaMock;
  let plans: any;
  let service: SubscriptionsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    plans = { getByTier: jest.fn().mockResolvedValue(makePlan({ tier: 'FREE' })) };
    service = new SubscriptionsService(prisma as any, plans);
  });

  it('marks cancelled / past-due / expired subscriptions inactive', () => {
    expect(service.isActive(makeSubscription({ status: 'CANCELLED' }) as any)).toBe(false);
    expect(service.isActive(makeSubscription({ status: 'PAST_DUE' }) as any)).toBe(false);
    expect(service.isActive(makeSubscription({ status: 'EXPIRED' }) as any)).toBe(false);
  });

  it('marks an active, unexpired subscription active — and an elapsed period inactive', () => {
    expect(service.isActive(makeSubscription({ currentPeriodEnd: new Date('2999-01-01') }) as any)).toBe(true);
    expect(service.isActive(makeSubscription({ currentPeriodEnd: new Date('2000-01-01') }) as any)).toBe(false);
  });

  it('falls back to the FREE plan when the subscription is inactive (data preserved)', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ status: 'EXPIRED' }),
      plan: makePlan({ tier: 'PRO', features: { advancedAnalytics: true } }),
    });
    const plan = await service.getEffectivePlan('store-A');
    expect(plans.getByTier).toHaveBeenCalledWith('FREE');
    expect(plan.tier).toBe('FREE');
  });

  it('assertFeature throws when the effective plan lacks the feature', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      ...makeSubscription(),
      plan: makePlan({ features: { basicDashboard: true } }),
    });
    await expect(service.assertFeature('store-A', 'analytics', 'التحليلات')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

import { NotFoundException } from '@nestjs/common';
import { PlansService } from '../../src/modules/subscriptions/plans.service';
import { createPrismaMock, PrismaMock } from '../helpers/prisma.mock';
import { makePlan } from '../helpers/factories';

describe('PlansService (Pricing)', () => {
  let prisma: PrismaMock;
  let service: PlansService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PlansService(prisma as any);
  });

  it('seeds the four canonical plans with correct prices (create-only)', async () => {
    prisma.plan.upsert.mockResolvedValue({});
    await service.ensureDefaults();

    const byTier: Record<string, any> = {};
    for (const call of prisma.plan.upsert.mock.calls) {
      byTier[call[0].where.tier] = call[0];
    }
    expect(Object.keys(byTier).sort()).toEqual(['BUSINESS', 'FREE', 'PRO', 'STARTER']);
    expect(byTier.FREE.create.priceMonthly.toString()).toBe('0');
    expect(byTier.STARTER.create.priceMonthly.toString()).toBe('5');
    expect(byTier.PRO.create.priceMonthly.toString()).toBe('12');
    expect(byTier.BUSINESS.create.priceMonthly.toString()).toBe('29');
    // create-only: لا يلمس الأسعار المعدّلة إداريًا
    expect(byTier.PRO.update).toEqual({});
    // حدود غير محدودة تُمثَّل بـ -1
    expect(byTier.PRO.create.productLimit).toBe(-1);
  });

  it('throws NotFound for a tier that does not exist', async () => {
    prisma.plan.upsert.mockResolvedValue({});
    prisma.plan.findUnique.mockResolvedValue(null);
    await expect(service.getByTier('PRO' as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('editPlan updates only the provided fields (admin editable pricing)', async () => {
    prisma.plan.upsert.mockResolvedValue({});
    prisma.plan.findUnique.mockResolvedValue(makePlan({ tier: 'PRO' }));
    prisma.plan.update.mockResolvedValue(makePlan({ tier: 'PRO', priceMonthly: '15' }));

    await service.editPlan('PRO' as any, { priceMonthly: 15 });
    const data = prisma.plan.update.mock.calls[0][0].data;
    expect(data.priceMonthly.toString()).toBe('15');
    expect(data.monthlyMessageLimit).toBeUndefined(); // لم نمرّره → لا يُلمَس
  });
});

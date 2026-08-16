import { Injectable, NotFoundException } from '@nestjs/common';
import { Plan, PlanTier, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface PlanSeed {
  tier: PlanTier;
  name: string;
  priceMonthly: number;
  monthlyMessageLimit: number;
  productLimit: number;
  staffLimit: number;
  features: Record<string, unknown>;
}

/** الخطط الافتراضية — تُنشأ مرّة واحدة، ثم تصبح الأسعار/الحدود قابلة للتعديل من لوحة المشرف. */
const DEFAULT_PLANS: PlanSeed[] = [
  {
    tier: 'FREE',
    name: 'مجاني',
    priceMonthly: 0,
    monthlyMessageLimit: 100,
    productLimit: 50,
    staffLimit: 1,
    features: { basicDashboard: true },
  },
  {
    tier: 'STARTER',
    name: 'المبتدئ',
    priceMonthly: 5,
    monthlyMessageLimit: 500,
    productLimit: 500,
    staffLimit: 2,
    features: { basicDashboard: true, orders: true, knowledgeBase: true, analytics: true },
  },
  {
    tier: 'PRO',
    name: 'الاحترافي',
    priceMonthly: 12,
    monthlyMessageLimit: 2000,
    productLimit: -1,
    staffLimit: -1,
    features: {
      basicDashboard: true,
      orders: true,
      knowledgeBase: true,
      analytics: true,
      advancedAnalytics: true,
      multipleStaff: true,
      prioritySupport: true,
    },
  },
  {
    tier: 'BUSINESS',
    name: 'الأعمال',
    priceMonthly: 29,
    monthlyMessageLimit: 10000,
    productLimit: -1,
    staffLimit: -1,
    features: {
      basicDashboard: true,
      orders: true,
      knowledgeBase: true,
      analytics: true,
      advancedAnalytics: true,
      multipleStaff: true,
      multipleStores: true,
      apiAccess: true,
      advancedAi: true,
      prioritySupport: true,
    },
  },
];

export interface EditPlanInput {
  priceMonthly?: number;
  monthlyMessageLimit?: number;
  productLimit?: number;
  staffLimit?: number;
  isActive?: boolean;
  features?: Record<string, unknown>;
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** ينشئ الخطط الناقصة فقط (لا يلمس التعديلات الإدارية على الموجودة). */
  async ensureDefaults(): Promise<void> {
    for (const p of DEFAULT_PLANS) {
      await this.prisma.plan.upsert({
        where: { tier: p.tier },
        update: {},
        create: {
          tier: p.tier,
          name: p.name,
          priceMonthly: new Prisma.Decimal(p.priceMonthly),
          monthlyMessageLimit: p.monthlyMessageLimit,
          productLimit: p.productLimit,
          staffLimit: p.staffLimit,
          features: p.features as Prisma.InputJsonValue,
        },
      });
    }
  }

  async list(): Promise<Plan[]> {
    await this.ensureDefaults();
    return this.prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  }

  async getByTier(tier: PlanTier): Promise<Plan> {
    await this.ensureDefaults();
    const plan = await this.prisma.plan.findUnique({ where: { tier } });
    if (!plan) {
      throw new NotFoundException(`الخطة ${tier} غير موجودة`);
    }
    return plan;
  }

  /** تعديل خطة (سعر/حدود/ميزات) — لمشرف المنصّة. */
  async editPlan(tier: PlanTier, dto: EditPlanInput): Promise<Plan> {
    await this.getByTier(tier);
    const data: Prisma.PlanUpdateInput = {};
    if (dto.priceMonthly !== undefined) {
      data.priceMonthly = new Prisma.Decimal(dto.priceMonthly);
    }
    if (dto.monthlyMessageLimit !== undefined) {
      data.monthlyMessageLimit = dto.monthlyMessageLimit;
    }
    if (dto.productLimit !== undefined) {
      data.productLimit = dto.productLimit;
    }
    if (dto.staffLimit !== undefined) {
      data.staffLimit = dto.staffLimit;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }
    if (dto.features !== undefined) {
      data.features = dto.features as Prisma.InputJsonValue;
    }
    return this.prisma.plan.update({ where: { tier }, data });
  }
}

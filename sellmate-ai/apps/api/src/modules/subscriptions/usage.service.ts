import { ForbiddenException, Injectable } from '@nestjs/common';
import { UsageMetric } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { currentPeriod } from '../../common/utils/date.util';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionsService } from './subscriptions.service';

/** قياس الاستخدام الشهري وفرض حدود الخطة. */
@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  async increment(merchantId: string, metric: UsageMetric, by = 1): Promise<void> {
    const period = currentPeriod();
    await this.prisma.usageRecord.upsert({
      where: { merchantId_metric_period: { merchantId, metric, period } },
      update: { count: { increment: by } },
      create: { merchantId, metric, period, count: by },
    });
    // عند اقتراب حد الرسائل: إشعار لحظي للمالك (بلا انتظار، بمنع تكرار داخليًا).
    if (metric === 'AI_MESSAGE') {
      void this.notifications.checkUsageNear(merchantId).catch(() => undefined);
    }
  }

  async getCount(merchantId: string, metric: UsageMetric, period = currentPeriod()): Promise<number> {
    const record = await this.prisma.usageRecord.findUnique({
      where: { merchantId_metric_period: { merchantId, metric, period } },
    });
    return record?.count ?? 0;
  }

  async getMonthlyUsage(merchantId: string) {
    const period = currentPeriod();
    const records = await this.prisma.usageRecord.findMany({ where: { merchantId, period } });
    const map = new Map(records.map((r) => [r.metric, r.count]));
    return {
      period,
      aiMessages: map.get('AI_MESSAGE') ?? 0,
      ordersCreated: map.get('ORDER_CREATED') ?? 0,
      telegramMessages: map.get('TELEGRAM_MESSAGE') ?? 0,
    };
  }

  /** يتحقق أن المتجر لم يتجاوز حد رسائل الذكاء الاصطناعي الشهري. */
  async assertWithinMessageLimit(merchantId: string): Promise<void> {
    const plan = await this.subscriptions.getEffectivePlan(merchantId);
    const limit = plan.monthlyMessageLimit;
    if (limit < 0) {
      return; // بلا حدود
    }
    const used = await this.getCount(merchantId, 'AI_MESSAGE');
    if (used >= limit) {
      throw new ForbiddenException(
        `تم بلوغ حد رسائل الذكاء الاصطناعي لهذا الشهر (${limit}). يرجى ترقية الخطة.`,
      );
    }
  }

  /** يتحقق أن المتجر لم يتجاوز حد عدد المنتجات في خطته. */
  async assertWithinProductLimit(merchantId: string): Promise<void> {
    const plan = await this.subscriptions.getEffectivePlan(merchantId);
    const limit = plan.productLimit;
    if (limit < 0) {
      return;
    }
    const count = await this.prisma.product.count({
      where: { merchantId, status: { not: 'ARCHIVED' } },
    });
    if (count >= limit) {
      throw new ForbiddenException(`تم بلوغ حد المنتجات في خطتك (${limit}). يرجى ترقية الخطة.`);
    }
  }

  /** يتحقق أن عدد مستخدمي المتجر لم يتجاوز حدّ الخطة (لميزة تعدّد الموظفين). */
  async assertWithinStaffLimit(merchantId: string): Promise<void> {
    const plan = await this.subscriptions.getEffectivePlan(merchantId);
    const limit = plan.staffLimit;
    if (limit < 0) {
      return;
    }
    const count = await this.prisma.user.count({ where: { merchantId, isActive: true } });
    if (count >= limit) {
      throw new ForbiddenException(
        `تم بلوغ حد المستخدمين في خطتك (${limit}). يرجى ترقية الاشتراك لإضافة المزيد.`,
      );
    }
  }
}

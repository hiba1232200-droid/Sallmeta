import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, PlanTier, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, currentPeriod } from '../../common/utils/date.util';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AdminChangeSubscriptionDto } from './dto/change-subscription.dto';

interface PageArgs {
  limit?: number;
  cursor?: string;
  search?: string;
}

/** خدمة لوحة المشرف — استعلامات وإجراءات عابرة لكل المتاجر (cross-tenant). */
@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // --------------------------------- نظرة عامة ---------------------------------

  async overview() {
    const period = currentPeriod();
    const [
      users,
      activeUsers,
      stores,
      activeStores,
      orders,
      subsByStatus,
      paidAgg,
      aiAgg,
      salesAgg,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.merchant.count(),
      this.prisma.merchant.count({ where: { isActive: true } }),
      this.prisma.order.count(),
      this.prisma.subscription.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      this.prisma.usageRecord.aggregate({
        where: { metric: 'AI_MESSAGE', period },
        _sum: { count: true },
      }),
      this.prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
    ]);

    const subscriptions: Record<string, number> = {};
    for (const row of subsByStatus) {
      subscriptions[row.status] = row._count?._all ?? 0;
    }

    return {
      users: { total: users, active: activeUsers, suspended: users - activeUsers },
      stores: { total: stores, active: activeStores, suspended: stores - activeStores },
      orders: { total: orders },
      subscriptions,
      revenue: {
        subscriptions: (paidAgg._sum.amount ?? 0).toString(),
        sales: (salesAgg._sum.total ?? 0).toString(),
      },
      aiMessagesThisMonth: aiAgg._sum.count ?? 0,
      period,
    };
  }

  // --------------------------------- صحّة النظام ---------------------------------

  async health() {
    let db = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'healthy' : 'degraded',
      db,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };
  }

  // --------------------------------- المستخدمون ---------------------------------

  async listUsers(args: PageArgs) {
    const limit = args.limit ?? 25;
    const where: Prisma.UserWhereInput = {};
    if (args.search) {
      where.OR = [
        { email: { contains: args.search, mode: 'insensitive' } },
        { name: { contains: args.search, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...this.cursor(args.cursor),
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        merchant: { select: { id: true, name: true, isActive: true } },
      },
    });
    return this.page(rows, limit);
  }

  async setUserActive(id: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    return updated;
  }

  // ---------------------------------- المتاجر ----------------------------------

  async listStores(args: PageArgs) {
    const limit = args.limit ?? 25;
    const where: Prisma.MerchantWhereInput = {};
    if (args.search) {
      where.OR = [
        { name: { contains: args.search, mode: 'insensitive' } },
        { slug: { contains: args.search, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.merchant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...this.cursor(args.cursor),
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        users: {
          where: { role: 'OWNER' },
          take: 1,
          select: { email: true, name: true },
        },
        subscription: { select: { status: true, plan: { select: { tier: true, name: true } } } },
        _count: { select: { products: true, orders: true, users: true, customers: true } },
      },
    });
    return this.page(rows, limit);
  }

  async setStoreActive(id: string, isActive: boolean) {
    const store = await this.prisma.merchant.findUnique({ where: { id } });
    if (!store) {
      throw new NotFoundException('المتجر غير موجود');
    }
    const updated = await this.prisma.merchant.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, slug: true, isActive: true },
    });
    return updated;
  }

  // -------------------------------- الاشتراكات --------------------------------

  async listSubscriptions(args: PageArgs & { status?: SubscriptionStatus }) {
    const limit = args.limit ?? 25;
    const where: Prisma.SubscriptionWhereInput = {};
    if (args.status) {
      where.status = args.status;
    }
    if (args.search) {
      where.merchant = { name: { contains: args.search, mode: 'insensitive' } };
    }
    const rows = await this.prisma.subscription.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      ...this.cursor(args.cursor),
      select: {
        id: true,
        status: true,
        currentPeriodEnd: true,
        trialEndsAt: true,
        cancelAtPeriodEnd: true,
        merchant: { select: { id: true, name: true, isActive: true } },
        plan: {
          select: { tier: true, name: true, priceMonthly: true, monthlyMessageLimit: true },
        },
      },
    });
    return this.page(rows, limit);
  }

  async changeSubscription(merchantId: string, dto: AdminChangeSubscriptionDto) {
    const existing = await this.prisma.subscription.findUnique({ where: { merchantId } });
    if (!existing) {
      throw new NotFoundException('لا يوجد اشتراك لهذا المتجر');
    }
    if (dto.tier) {
      await this.subscriptions.changePlan(merchantId, dto.tier as PlanTier);
    }
    if (dto.status) {
      await this.prisma.subscription.update({
        where: { merchantId },
        data: {
          status: dto.status,
          // إعادة التفعيل تمدّد الفترة الحالية شهرًا.
          ...(dto.status === 'ACTIVE' ? { currentPeriodEnd: addDays(new Date(), 30) } : {}),
        },
      });
    }
    const { subscription, plan } = await this.subscriptions.getForMerchant(merchantId);
    return this.subscriptions.toPublic(subscription, plan);
  }

  // ---------------------------------- المدفوعات ----------------------------------

  async listPayments(args: PageArgs & { status?: string }) {
    const limit = args.limit ?? 25;
    const where: Prisma.PaymentWhereInput = {};
    if (args.status) {
      where.status = args.status;
    }
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...this.cursor(args.cursor),
    });
    const paged = this.page(rows, limit);
    const names = await this.merchantNames(paged.items.map((p) => p.merchantId));
    return {
      ...paged,
      items: paged.items.map((p) => ({
        ...p,
        amount: p.amount.toString(),
        merchantName: names.get(p.merchantId) ?? '(متجر محذوف)',
      })),
    };
  }

  // ---------------------------------- الطلبات ----------------------------------

  async listOrders(args: PageArgs & { status?: OrderStatus }) {
    const limit = args.limit ?? 25;
    const where: Prisma.OrderWhereInput = {};
    if (args.status) {
      where.status = args.status;
    }
    if (args.search) {
      where.OR = [
        { number: { contains: args.search, mode: 'insensitive' } },
        { customerName: { contains: args.search, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...this.cursor(args.cursor),
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        currency: true,
        customerName: true,
        createdAt: true,
        merchant: { select: { id: true, name: true } },
      },
    });
    const paged = this.page(rows, limit);
    return {
      ...paged,
      items: paged.items.map((o) => ({ ...o, total: o.total.toString() })),
    };
  }

  // -------------------------------- استخدام الذكاء --------------------------------

  async aiUsage(period = currentPeriod()) {
    const records = await this.prisma.usageRecord.findMany({
      where: { metric: 'AI_MESSAGE', period },
      orderBy: { count: 'desc' },
      take: 100,
    });
    const names = await this.merchantNames(records.map((r) => r.merchantId));
    const total = records.reduce((sum, r) => sum + r.count, 0);
    return {
      period,
      total,
      stores: records.map((r) => ({
        merchantId: r.merchantId,
        merchantName: names.get(r.merchantId) ?? '(متجر محذوف)',
        count: r.count,
      })),
    };
  }

  // ---------------------------------- السجلّات ----------------------------------

  async listAuditLogs(args: PageArgs & { action?: string; merchantId?: string }) {
    const limit = args.limit ?? 25;
    const where: Prisma.AuditLogWhereInput = {};
    if (args.action) {
      where.action = args.action;
    }
    if (args.merchantId) {
      where.merchantId = args.merchantId;
    }
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...this.cursor(args.cursor),
    });
    return this.page(rows, limit);
  }

  async listErrors(args: PageArgs) {
    const limit = args.limit ?? 25;
    const rows = await this.prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...this.cursor(args.cursor),
    });
    return this.page(rows, limit);
  }

  // ---------------------------------- التقارير ----------------------------------

  async reports() {
    const since = addDays(new Date(), -30);
    const [revenueByTier, subsByStatus, topStoresRaw, newStores, newUsers] =
      await this.prisma.$transaction([
        this.prisma.payment.groupBy({
          by: ['planTier'],
          where: { status: 'PAID' },
          _sum: { amount: true },
          _count: { _all: true },
          orderBy: { planTier: 'asc' },
        }),
        this.prisma.subscription.groupBy({
          by: ['status'],
          _count: { _all: true },
          orderBy: { status: 'asc' },
        }),
        this.prisma.order.groupBy({
          by: ['merchantId'],
          _count: { _all: true },
          _sum: { total: true },
          orderBy: { _count: { merchantId: 'desc' } },
          take: 10,
        }),
        this.prisma.merchant.count({ where: { createdAt: { gte: since } } }),
        this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      ]);

    const names = await this.merchantNames(topStoresRaw.map((s) => s.merchantId));

    return {
      revenueByTier: revenueByTier.map((r) => ({
        tier: r.planTier ?? 'UNKNOWN',
        total: (r._sum?.amount ?? 0).toString(),
        count: r._count?._all ?? 0,
      })),
      subscriptionsByStatus: subsByStatus.map((s) => ({
        status: s.status,
        count: s._count?._all ?? 0,
      })),
      topStores: topStoresRaw.map((s) => ({
        merchantId: s.merchantId,
        merchantName: names.get(s.merchantId) ?? '(متجر محذوف)',
        orders: s._count?._all ?? 0,
        sales: (s._sum?.total ?? 0).toString(),
      })),
      last30Days: { newStores, newUsers },
    };
  }

  // ---------------------------------- أدوات ----------------------------------

  /** يبني معامل المؤشّر لـ Prisma (يتخطّى العنصر المرجعي). */
  private cursor(cursor?: string) {
    return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
  }

  /** يقصّ النتائج إلى الحد ويستخرج مؤشّر الصفحة التالية. */
  private page<T extends { id: string }>(rows: T[], limit: number) {
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  /** يجلب أسماء المتاجر دفعة واحدة (للسجلّات التي لا ترتبط بمفتاح خارجي). */
  private async merchantNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) {
      return new Map();
    }
    const merchants = await this.prisma.merchant.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(merchants.map((m) => [m.id, m.name]));
  }
}

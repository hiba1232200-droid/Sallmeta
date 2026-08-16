import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays } from '../../common/utils/date.util';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsageService } from '../subscriptions/usage.service';

export type AnalyticsRange = 'today' | '7d' | '30d' | 'all';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async getOverview(merchantId: string) {
    const [
      activeProducts,
      totalOrders,
      pendingOrders,
      totalCustomers,
      openConversations,
      totalConversations,
      byStatus,
      revenue,
      recentOrders,
      recentConversations,
      topProductsRaw,
    ] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { merchantId, status: 'ACTIVE' } }),
      this.prisma.order.count({ where: { merchantId } }),
      this.prisma.order.count({ where: { merchantId, status: 'PENDING' } }),
      this.prisma.customer.count({ where: { merchantId } }),
      this.prisma.conversation.count({ where: { merchantId, status: { not: 'CLOSED' } } }),
      this.prisma.conversation.count({ where: { merchantId } }),
      this.prisma.order.groupBy({ by: ['status'], where: { merchantId }, _count: { _all: true } }),
      this.prisma.order.aggregate({
        where: { merchantId, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      this.prisma.order.findMany({
        where: { merchantId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
          customerName: true,
        },
      }),
      this.prisma.conversation.findMany({
        where: { merchantId },
        orderBy: { lastMessageAt: 'desc' },
        take: 6,
        include: {
          customer: { select: { firstName: true, lastName: true, username: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productName'],
        where: { merchantId },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const usage = await this.usage.getMonthlyUsage(merchantId);

    const ordersByStatus = this.emptyStatusMap();
    for (const row of byStatus) {
      ordersByStatus[row.status] = row._count._all;
    }

    const conversionRate =
      totalConversations > 0 ? Math.round((totalOrders / totalConversations) * 1000) / 10 : 0;

    const topProducts = topProductsRaw.map((r) => ({
      name: r.productName,
      quantity: r._sum.quantity ?? 0,
      revenue: (r._sum.lineTotal ?? 0).toString(),
    }));

    const recentConversationsView = recentConversations.map((c) => ({
      id: c.id,
      name:
        [c.customer?.firstName, c.customer?.lastName].filter(Boolean).join(' ') ||
        c.customer?.username ||
        'عميل',
      status: c.status,
      lastMessageAt: c.lastMessageAt,
      messages: c._count.messages,
    }));

    return {
      sales: { total: revenue._sum.total?.toString() ?? '0' },
      revenue: { total: revenue._sum.total?.toString() ?? '0' },
      orders: { total: totalOrders, pending: pendingOrders, byStatus: ordersByStatus },
      customers: { total: totalCustomers },
      conversations: { open: openConversations, total: totalConversations },
      products: { active: activeProducts },
      conversionRate,
      usage,
      topProducts,
      recentOrders,
      recentConversations: recentConversationsView,
    };
  }

  /** سلسلة زمنية يومية لآخر N يومًا: الطلبات، الإيرادات، العملاء الجدد، رسائل المساعد. */
  async getSeries(merchantId: string, days: number) {
    await this.subscriptions.assertFeature(merchantId, 'analytics', 'التحليلات');
    const since = addDays(new Date(), -days);
    const [orders, customers, messages] = await Promise.all([
      this.prisma.order.findMany({
        where: { merchantId, status: { not: 'CANCELLED' }, createdAt: { gte: since } },
        select: { total: true, createdAt: true },
      }),
      this.prisma.customer.findMany({
        where: { merchantId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.message.findMany({
        where: { merchantId, role: 'ASSISTANT', createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

    const buckets = new Map<
      string,
      { orders: number; revenue: number; customers: number; aiMessages: number }
    >();
    for (let i = 0; i <= days; i++) {
      buckets.set(this.dateKey(addDays(since, i)), {
        orders: 0,
        revenue: 0,
        customers: 0,
        aiMessages: 0,
      });
    }
    for (const o of orders) {
      const b = buckets.get(this.dateKey(o.createdAt));
      if (b) {
        b.orders += 1;
        b.revenue += Number(o.total);
      }
    }
    for (const c of customers) {
      const b = buckets.get(this.dateKey(c.createdAt));
      if (b) {
        b.customers += 1;
      }
    }
    for (const m of messages) {
      const b = buckets.get(this.dateKey(m.createdAt));
      if (b) {
        b.aiMessages += 1;
      }
    }

    return {
      days,
      series: [...buckets.entries()].map(([date, v]) => ({
        date,
        orders: v.orders,
        revenue: Number(v.revenue.toFixed(2)),
        customers: v.customers,
        aiMessages: v.aiMessages,
      })),
    };
  }

  /**
   * محرّك التحليلات: كل المؤشّرات لنطاق زمني محدّد (اليوم/٧/٣٠ يومًا/كل الوقت).
   * معدّل التحويل = الطلبات المكتملة ÷ المحادثات.
   */
  async getMetrics(merchantId: string, range: AnalyticsRange) {
    await this.subscriptions.assertFeature(merchantId, 'analytics', 'التحليلات');
    const since = this.rangeSince(range);
    const inRange = since ? { createdAt: { gte: since } } : {};

    const [
      messages,
      aiResponses,
      orders,
      completedOrders,
      cancelledOrders,
      revenueAgg,
      conversations,
      activeCustomers,
      topProductsRaw,
    ] = await this.prisma.$transaction([
      this.prisma.message.count({ where: { merchantId, role: 'CUSTOMER', ...inRange } }),
      this.prisma.message.count({ where: { merchantId, role: 'ASSISTANT', ...inRange } }),
      this.prisma.order.count({ where: { merchantId, ...inRange } }),
      this.prisma.order.count({ where: { merchantId, status: 'COMPLETED', ...inRange } }),
      this.prisma.order.count({ where: { merchantId, status: 'CANCELLED', ...inRange } }),
      this.prisma.order.aggregate({
        where: { merchantId, status: { not: 'CANCELLED' }, ...inRange },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.conversation.count({ where: { merchantId, ...inRange } }),
      this.prisma.customer.count({
        where: { merchantId, ...(since ? { lastSeenAt: { gte: since } } : {}) },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productName'],
        where: {
          merchantId,
          order: { status: { not: 'CANCELLED' }, ...(since ? { createdAt: { gte: since } } : {}) },
        },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const revenue = Number(revenueAgg._sum.total ?? 0);
    const paidOrders = revenueAgg._count._all;
    const conversionRate =
      conversations > 0 ? Math.round((completedOrders / conversations) * 1000) / 10 : 0;
    const averageOrderValue = paidOrders > 0 ? revenue / paidOrders : 0;

    return {
      range,
      since: since ? since.toISOString() : null,
      messages,
      aiResponses,
      orders,
      completedOrders,
      cancelledOrders,
      revenue: revenue.toFixed(2),
      conversations,
      conversionRate,
      averageOrderValue: averageOrderValue.toFixed(2),
      activeCustomers,
      topProducts: topProductsRaw.map((r) => ({
        name: r.productName,
        quantity: r._sum.quantity ?? 0,
        revenue: (r._sum.lineTotal ?? 0).toString(),
      })),
    };
  }

  /** يحوّل النطاق إلى تاريخ البداية (أو undefined لـ «كل الوقت»). */
  private rangeSince(range: AnalyticsRange): Date | undefined {
    const now = new Date();
    switch (range) {
      case 'today': {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case '7d':
        return addDays(now, -7);
      case '30d':
        return addDays(now, -30);
      case 'all':
      default:
        return undefined;
    }
  }

  private emptyStatusMap(): Record<OrderStatus, number> {
    return {
      PENDING: 0,
      CONFIRMED: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}

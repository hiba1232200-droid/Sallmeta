import { Injectable } from '@nestjs/common';
import { NotificationType, Order, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { currentPeriod } from '../../common/utils/date.util';
import { TelegramNotifier } from './telegram-notifier.service';

const DAY_MS = 86_400_000;
const USAGE_NEAR_RATIO = 0.8; // إشعار عند بلوغ 80% من حد الرسائل
const EXPIRY_DAYS = 3; // إشعار قبل انتهاء الاشتراك بـ 3 أيام

/** مفتاح رسالة العميل: إنشاء الطلب أو أي حالة طلب (PENDING تُتجاهَل). */
type CustomerEvent = 'CREATED' | OrderStatus;

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
}

/**
 * نظام الإشعارات — إشعارات صاحب المتجر (تُخزَّن + تُرسَل عبر تيليجرام)
 * وإشعارات العميل (تُرسَل عبر تيليجرام لحظيًا).
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: TelegramNotifier,
  ) {}

  // ============================ إشعارات صاحب المتجر ============================

  /** يخزّن الإشعار ويُرسله للمالك عبر تيليجرام (أفضل جهد). */
  private async pushOwner(
    merchantId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: { merchantId, type, title, body, data: (data ?? undefined) as Prisma.InputJsonValue },
      });
    } catch {
      /* تخزين الإشعار أفضل جهد */
    }
    await this.notifier.sendToOwner(merchantId, `${title}\n${body}`);
  }

  async newOrder(order: Order): Promise<void> {
    const who = order.customerName ? ` — ${order.customerName}` : '';
    await this.pushOwner(
      order.merchantId,
      'NEW_ORDER',
      '🛒 طلب جديد',
      `الطلب ${order.number} بقيمة ${order.total} ${order.currency}${who}`,
      { orderId: order.id, number: order.number },
    );
  }

  async newCustomer(
    merchantId: string,
    customer: { id: string; firstName?: string | null; lastName?: string | null; username?: string | null },
  ): Promise<void> {
    const name =
      [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
      customer.username ||
      'عميل جديد';
    await this.pushOwner(merchantId, 'NEW_CUSTOMER', '👤 عميل جديد', name, { customerId: customer.id });
  }

  async humanAssistance(
    merchantId: string,
    opts: { customerId?: string; conversationId?: string },
  ): Promise<void> {
    let name = 'عميل';
    if (opts.customerId) {
      const c = await this.prisma.customer.findUnique({
        where: { id: opts.customerId },
        select: { firstName: true, lastName: true, username: true },
      });
      if (c) {
        name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || 'عميل';
      }
    }
    await this.pushOwner(
      merchantId,
      'HUMAN_ASSISTANCE_REQUIRED',
      '🔔 طلب تدخّل بشري',
      `${name} يطلب التحدث مع موظف.`,
      { conversationId: opts.conversationId, customerId: opts.customerId },
    );
  }

  async lowStock(merchantId: string, product: LowStockProduct): Promise<void> {
    await this.pushOwner(
      merchantId,
      'LOW_STOCK',
      '⚠️ مخزون منخفض',
      `${product.name} — المتبقّي ${product.stock}`,
      { productId: product.id, stock: product.stock },
    );
  }

  // ============================ إشعارات العميل ============================

  /** يُرسل للعميل إشعارًا بحالة طلبه عبر تيليجرام. */
  async orderStatus(order: Order, event: CustomerEvent): Promise<void> {
    const chatId = await this.resolveCustomerChat(order);
    if (!chatId) {
      return;
    }
    const msg = this.customerMessage(order, event);
    if (msg) {
      await this.notifier.send(order.merchantId, chatId, msg);
    }
  }

  private async resolveCustomerChat(order: Order): Promise<string | null> {
    if (order.conversationId) {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: order.conversationId },
        select: { externalChatId: true },
      });
      if (conv?.externalChatId) {
        return conv.externalChatId;
      }
    }
    if (order.customerId) {
      const cust = await this.prisma.customer.findUnique({
        where: { id: order.customerId },
        select: { telegramId: true },
      });
      if (cust?.telegramId != null) {
        return cust.telegramId.toString();
      }
    }
    return null;
  }

  private customerMessage(order: Order, event: CustomerEvent): string | null {
    const n = order.number;
    switch (event) {
      case 'CREATED':
        return `✅ تم إنشاء طلبك رقم ${n} بقيمة ${order.total} ${order.currency}. سنؤكّده قريبًا.`;
      case 'CONFIRMED':
        return `👍 تم تأكيد طلبك رقم ${n}. جارٍ التحضير.`;
      case 'PROCESSING':
        return `🛠️ جارٍ تجهيز طلبك رقم ${n}.`;
      case 'SHIPPED':
        return `🚚 تم شحن طلبك رقم ${n}. في الطريق إليك!`;
      case 'COMPLETED':
        return `🎉 تم اكتمال طلبك رقم ${n}. شكرًا لثقتك بنا!`;
      case 'CANCELLED':
        return `❌ تم إلغاء طلبك رقم ${n}. للاستفسار تواصل مع المتجر.`;
      default:
        return null;
    }
  }

  // ============================ فحوص زمنية (بمنع تكرار) ============================

  /** إشعار عند اقتراب حدّ الرسائل الشهري (مرّة واحدة لكل فترة). */
  async checkUsageNear(merchantId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({
      where: { merchantId },
      include: { plan: true },
    });
    if (!sub) {
      return;
    }
    const limit = sub.plan.monthlyMessageLimit;
    if (limit <= 0) {
      return; // غير محدود
    }
    const period = currentPeriod();
    const rec = await this.prisma.usageRecord.findUnique({
      where: { merchantId_metric_period: { merchantId, metric: 'AI_MESSAGE', period } },
    });
    const used = rec?.count ?? 0;
    if (used < Math.floor(limit * USAGE_NEAR_RATIO)) {
      return;
    }
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
    const existing = await this.prisma.notification.findFirst({
      where: { merchantId, type: 'USAGE_LIMIT_NEAR', createdAt: { gte: periodStart } },
    });
    if (existing) {
      return;
    }
    await this.pushOwner(
      merchantId,
      'USAGE_LIMIT_NEAR',
      '📊 اقتربت من حد الرسائل',
      `استخدمت ${used} من ${limit} رسالة هذا الشهر. فكّر بالترقية لتفادي التوقّف.`,
      { used, limit },
    );
  }

  /** إشعار عند اقتراب انتهاء الاشتراك (مرّة واحدة كل 24 ساعة). */
  async checkSubscriptionExpiring(merchantId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({ where: { merchantId } });
    if (!sub) {
      return;
    }
    if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED' || sub.status === 'PAST_DUE') {
      return;
    }
    const days = Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / DAY_MS);
    if (days < 0 || days > EXPIRY_DAYS) {
      return;
    }
    const since = new Date(Date.now() - DAY_MS);
    const existing = await this.prisma.notification.findFirst({
      where: { merchantId, type: 'SUBSCRIPTION_EXPIRING', createdAt: { gte: since } },
    });
    if (existing) {
      return;
    }
    await this.pushOwner(
      merchantId,
      'SUBSCRIPTION_EXPIRING',
      '⏳ اشتراكك ينتهي قريبًا',
      days <= 0
        ? 'ينتهي اشتراكك اليوم. جدّد لتفادي إيقاف الميزات المدفوعة.'
        : `ينتهي اشتراكك خلال ${days} يوم/أيام. جدّد لتفادي إيقاف الميزات.`,
      { days },
    );
  }

  /** يُشغّل الفحوص الزمنية (للجدولة اليومية أو عند فتح اللوحة). */
  async runChecks(merchantId: string): Promise<void> {
    await this.checkSubscriptionExpiring(merchantId).catch(() => undefined);
    await this.checkUsageNear(merchantId).catch(() => undefined);
  }

  // ============================ موجز الإشعارات (اللوحة) ============================

  async list(merchantId: string, opts: { limit?: number; cursor?: string; unreadOnly?: boolean }) {
    const limit = opts.limit ?? 20;
    const where: Prisma.NotificationWhereInput = { merchantId };
    if (opts.unreadOnly) {
      where.isRead = false;
    }
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async unreadCount(merchantId: string) {
    const count = await this.prisma.notification.count({ where: { merchantId, isRead: false } });
    return { count };
  }

  async markRead(merchantId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, merchantId }, data: { isRead: true } });
    return { success: true };
  }

  async markAllRead(merchantId: string) {
    await this.prisma.notification.updateMany({
      where: { merchantId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }
}

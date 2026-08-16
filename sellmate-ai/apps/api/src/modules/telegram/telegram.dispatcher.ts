import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Customer, TelegramBot } from '@prisma/client';
import { Telegram } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesAgentService } from '../ai/sales-agent.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MerchantsService } from '../merchants/merchants.service';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { UsageService } from '../subscriptions/usage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BTN, CB } from './telegram.constants';
import * as KB from './telegram.keyboards';
import * as M from './telegram.messages';

/** سياق معالجة تحديث واحد من بوت متجر معيّن. */
export interface BotContext {
  tg: Telegram;
  bot: TelegramBot;
  merchantId: string;
  chatId: string;
  isOwner: boolean;
  customer: Customer;
  conversationId: string;
  conversationStatus: string;
}

const PAGE = 6;

/**
 * يوزّع تحديثات تيليجرام على المعالجات المناسبة: أوامر، أزرار ضمنية، ونصوص حرّة.
 * كل رسالة نصية حرّة تمرّ عبر خط المعالجة المؤصَّل (identify → knowledge → AI → validate).
 */
@Injectable()
export class TelegramDispatcher {
  private readonly logger = new Logger(TelegramDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly merchants: MerchantsService,
    private readonly products: ProductsService,
    private readonly orders: OrdersService,
    private readonly conversations: ConversationsService,
    private readonly usage: UsageService,
    private readonly analytics: AnalyticsService,
    private readonly agent: SalesAgentService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------ نقاط الدخول ------------------------------

  async handleText(ctx: BotContext, raw: string): Promise<void> {
    const text = raw.trim();
    if (!text) {
      return;
    }

    // صاحب المتجر متولٍّ المحادثة أو بانتظار موظف: البوت صامت، نسجّل رسالة العميل فقط.
    if (ctx.conversationStatus === 'HUMAN_ACTIVE' || ctx.conversationStatus === 'WAITING_FOR_HUMAN') {
      await this.conversations.addMessage({
        merchantId: ctx.merchantId,
        conversationId: ctx.conversationId,
        role: 'CUSTOMER',
        content: text,
      });
      return;
    }
    // إعادة تفعيل محادثة مغلقة عند عودة العميل.
    if (ctx.conversationStatus === 'CLOSED') {
      await this.conversations
        .setStatus(ctx.merchantId, ctx.conversationId, 'AI_ACTIVE')
        .catch(() => undefined);
    }

    if (text.startsWith('/')) {
      return this.handleCommand(ctx, text);
    }
    switch (text) {
      case BTN.PRODUCTS:
        return this.sendProducts(ctx, 0);
      case BTN.SEARCH:
        return this.send(ctx, M.MSG.searchPrompt);
      case BTN.MY_ORDERS:
      case BTN.ORDERS_ADMIN:
        return this.sendOrders(ctx);
      case BTN.SUPPORT:
        return this.sendSupport(ctx);
      case BTN.STATS:
        return this.sendStats(ctx);
      case BTN.ASSISTANT:
      case BTN.SETTINGS:
        return this.sendSettings(ctx);
      default:
        return this.processAi(ctx, text);
    }
  }

  async handleCommand(ctx: BotContext, text: string): Promise<void> {
    const cmd = text.slice(1).split(/[\s@]/)[0].toLowerCase();
    switch (cmd) {
      case 'start':
        return this.sendWelcome(ctx);
      case 'help':
        return this.send(ctx, M.helpMessage(ctx.isOwner));
      case 'products':
        return this.sendProducts(ctx, 0);
      case 'order':
        return this.send(ctx, M.MSG.orderPrompt);
      case 'orders':
        return this.sendOrders(ctx);
      case 'support':
        return this.sendSupport(ctx);
      case 'settings':
        return this.sendSettings(ctx);
      default:
        return this.send(ctx, M.helpMessage(ctx.isOwner));
    }
  }

  async handleCallback(ctx: BotContext, data: string): Promise<void> {
    // أثناء تولّي الموظف أو انتظاره، لا يتفاعل البوت مع الأزرار.
    if (ctx.conversationStatus === 'HUMAN_ACTIVE' || ctx.conversationStatus === 'WAITING_FOR_HUMAN') {
      return;
    }
    const [action, arg] = data.split(':');
    switch (action) {
      case CB.PRODUCTS_PAGE:
        return this.sendProducts(ctx, Number(arg) || 0);
      case CB.PRODUCT:
        return this.sendProductDetail(ctx, arg);
      case CB.BUY:
        return this.buyProduct(ctx, arg);
      case CB.MY_ORDERS:
        return this.sendOrders(ctx);
      case CB.SUPPORT:
        return this.sendSupport(ctx);
      case CB.STATS:
        return this.sendStats(ctx);
      case CB.HELP:
        return this.send(ctx, M.helpMessage(ctx.isOwner));
      case CB.AI_ON:
        return this.toggleAssistant(ctx, true);
      case CB.AI_OFF:
        return this.toggleAssistant(ctx, false);
      case CB.MENU:
        return this.sendWelcome(ctx);
      default:
        return undefined;
    }
  }

  // ------------------------------- المعالجات -------------------------------

  private async sendWelcome(ctx: BotContext): Promise<void> {
    const settings = await this.merchants.getAiSettings(ctx.merchantId);
    const store = await this.merchants.getProfile(ctx.merchantId);
    if (ctx.isOwner) {
      await this.send(ctx, M.ownerWelcome(store.name), KB.ownerReplyKeyboard());
      await this.send(ctx, 'إدارة سريعة:', KB.ownerMenuInline(this.appUrl(), settings.enabled));
    } else {
      await this.send(
        ctx,
        M.customerWelcome(store.name, settings.welcomeMessage),
        KB.customerReplyKeyboard(),
      );
      await this.send(ctx, 'اختر ما يناسبك:', KB.customerMenuInline());
    }
  }

  private async sendProducts(ctx: BotContext, offset: number): Promise<void> {
    const currency = await this.currency(ctx.merchantId);
    const { items, total } = await this.products.pageActive(ctx.merchantId, offset, PAGE);
    if (total === 0) {
      return this.send(ctx, M.MSG.noProducts);
    }
    const to = Math.min(offset + PAGE, total);
    await this.send(
      ctx,
      `🛍️ منتجاتنا (${offset + 1}–${to} من ${total}):`,
      KB.productsInline(items, currency, offset, PAGE, total),
    );
  }

  private async sendProductDetail(ctx: BotContext, productId: string): Promise<void> {
    const currency = await this.currency(ctx.merchantId);
    const product = await this.products.getActive(ctx.merchantId, productId);
    if (!product) {
      return this.send(ctx, M.MSG.productMissing);
    }
    await this.send(ctx, M.productDetail(product, currency), KB.productDetailInline(product.id));
  }

  private async buyProduct(ctx: BotContext, productId: string): Promise<void> {
    const product = await this.products.getActive(ctx.merchantId, productId);
    if (!product) {
      return this.send(ctx, M.MSG.productMissing);
    }
    // نمرّر الطلب للمساعد ليجمع الكمية وبيانات العميل وينشئ الطلب عبر أدواته المؤصَّلة.
    return this.processAi(ctx, `أريد طلب المنتج: ${product.name}`);
  }

  private async sendOrders(ctx: BotContext): Promise<void> {
    if (ctx.isOwner) {
      const page = await this.orders.findAll(ctx.merchantId, { page: 1, limit: 8 } as any);
      const items = page.items.map((o: any) => ({
        number: o.number,
        status: o.status,
        total: o.total,
        currency: o.currency,
      }));
      return this.send(ctx, M.ordersList('📦 أحدث طلبات المتجر:', items));
    }
    const list = await this.orders.listByCustomer(ctx.merchantId, ctx.customer.id, 8);
    const items = list.map((o) => ({
      number: o.number,
      status: o.status,
      total: o.total,
      currency: o.currency,
    }));
    return this.send(ctx, M.ordersList('📦 طلباتك:', items));
  }

  private async sendSupport(ctx: BotContext): Promise<void> {
    const store = await this.merchants.getProfile(ctx.merchantId);
    await this.conversations
      .setStatus(ctx.merchantId, ctx.conversationId, 'WAITING_FOR_HUMAN')
      .catch(() => undefined);
    await this.notifications
      .humanAssistance(ctx.merchantId, { customerId: ctx.customer.id, conversationId: ctx.conversationId })
      .catch(() => undefined);
    await this.send(ctx, M.supportMessage(store.name, store.phone, store.email));
  }

  private async sendSettings(ctx: BotContext): Promise<void> {
    if (!ctx.isOwner) {
      return this.send(ctx, M.MSG.ownerOnly);
    }
    const settings = await this.merchants.getAiSettings(ctx.merchantId);
    return this.send(ctx, '⚙️ إعدادات المتجر:', KB.ownerSettingsInline(this.appUrl(), settings.enabled));
  }

  private async sendStats(ctx: BotContext): Promise<void> {
    if (!ctx.isOwner) {
      return this.send(ctx, M.MSG.ownerOnly);
    }
    const overview = await this.analytics.getOverview(ctx.merchantId);
    return this.send(ctx, M.statsMessage(overview));
  }

  private async toggleAssistant(ctx: BotContext, enable: boolean): Promise<void> {
    if (!ctx.isOwner) {
      return this.send(ctx, M.MSG.ownerOnly);
    }
    await this.merchants.updateAiSettings(ctx.merchantId, { enabled: enable });
    await this.send(
      ctx,
      enable ? M.MSG.assistantOn : M.MSG.assistantOff,
      KB.ownerSettingsInline(this.appUrl(), enable),
    );
  }

  /**
   * خط المعالجة المؤصَّل:
   * Identify Customer (جاهز في ctx) → حدود الاستخدام → حفظ رسالة العميل →
   * AI (يحمّل معرفة المتجر عبر الأدوات) → التحقّق من الردّ (داخل الوكيل) → إرسال.
   */
  private async processAi(ctx: BotContext, text: string): Promise<void> {
    try {
      await this.usage.assertWithinMessageLimit(ctx.merchantId);
    } catch {
      await this.send(ctx, M.MSG.limitReached);
      return;
    }

    await this.conversations.addMessage({
      merchantId: ctx.merchantId,
      conversationId: ctx.conversationId,
      role: 'CUSTOMER',
      content: text,
    });

    try {
      await ctx.tg.sendChatAction(ctx.chatId, 'typing');
    } catch {
      // غير حرج
    }

    const result = await this.agent.process({
      merchantId: ctx.merchantId,
      conversationId: ctx.conversationId,
      customerId: ctx.customer.id,
      userText: text,
    });

    if (result.disabled) {
      await this.send(ctx, M.MSG.assistantDisabled);
      return;
    }

    await this.conversations.addMessage({
      merchantId: ctx.merchantId,
      conversationId: ctx.conversationId,
      role: 'ASSISTANT',
      content: result.reply,
      metadata: { toolTrace: result.toolTrace, validated: result.validated } as any,
    });

    await this.send(ctx, result.reply, ctx.isOwner ? undefined : KB.customerMenuInline());

    if (result.handoff) {
      await this.conversations
        .setStatus(ctx.merchantId, ctx.conversationId, 'WAITING_FOR_HUMAN')
        .catch(() => undefined);
      await this.notifications
        .humanAssistance(ctx.merchantId, { customerId: ctx.customer.id, conversationId: ctx.conversationId })
        .catch(() => undefined);
    }
    // إشعار «طلب جديد» للمالك و«تم إنشاء الطلب» للعميل يتمّان مركزيًا في OrdersService.createOrder.
    await this.usage.increment(ctx.merchantId, 'TELEGRAM_MESSAGE').catch(() => undefined);
  }

  // ------------------------------- مساعدات -------------------------------

  private appUrl(): string {
    return this.config.get<string>('app.url') ?? 'http://localhost:3000';
  }

  private async currency(merchantId: string): Promise<string> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { currency: true },
    });
    return merchant?.currency ?? 'USD';
  }

  private async send(ctx: BotContext, text: string, extra?: any): Promise<void> {
    try {
      await ctx.tg.sendMessage(ctx.chatId, text, extra);
    } catch (err) {
      this.logger.warn(`تعذّر إرسال الرسالة: ${(err as Error).message}`);
    }
  }
}

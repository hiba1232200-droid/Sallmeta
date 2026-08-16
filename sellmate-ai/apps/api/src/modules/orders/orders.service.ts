import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Order, OrderSource, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, skipTake } from '../../common/utils/pagination.util';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsageService } from '../subscriptions/usage.service';
import { NotificationsService, LowStockProduct } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';

export interface CreateOrderInput {
  items: { productId: string; quantity: number }[];
  source: OrderSource;
  customerId?: string;
  conversationId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  notes?: string;
  discount?: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  createFromDashboard(merchantId: string, dto: CreateOrderDto): Promise<Order> {
    return this.createOrder(merchantId, { ...dto, source: 'DASHBOARD' });
  }

  createFromConversation(merchantId: string, input: Omit<CreateOrderInput, 'source'>): Promise<Order> {
    return this.createOrder(merchantId, { ...input, source: 'TELEGRAM' });
  }

  /**
   * ينشئ الطلب داخل معاملة ذرّية:
   * - يحسب الأسعار من قاعدة البيانات فقط (لا يثق بأي سعر من العميل).
   * - يتحقق من توفّر المخزون ويخصمه ويسجّل الحركة.
   */
  async createOrder(merchantId: string, input: CreateOrderInput): Promise<Order> {
    if (!input.items?.length) {
      throw new BadRequestException('لا يمكن إنشاء طلب بدون منتجات');
    }
    await this.subscriptions.assertFeature(merchantId, 'orders', 'الطلبات');

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { currency: true },
    });
    const currency = merchant?.currency ?? 'USD';
    const lowStockProducts: LowStockProduct[] = [];

    const order = await this.prisma.$transaction(async (tx) => {
      const qtyByProduct = new Map<string, number>();
      for (const item of input.items) {
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
      }
      const productIds = [...qtyByProduct.keys()];
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, merchantId },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException('أحد المنتجات المطلوبة غير موجود');
      }

      const number = this.generateOrderNumber();
      let subtotal = new Prisma.Decimal(0);
      const itemsData: Prisma.OrderItemCreateManyOrderInput[] = [];

      for (const product of products) {
        if (product.status !== 'ACTIVE') {
          throw new BadRequestException(`المنتج "${product.name}" غير متاح حاليًا`);
        }
        const qty = qtyByProduct.get(product.id) as number;
        if (product.trackInventory && product.stock < qty) {
          throw new BadRequestException(
            `الكمية المتوفرة من "${product.name}" غير كافية (المتوفر: ${product.stock})`,
          );
        }
        const lineTotal = product.price.mul(qty);
        subtotal = subtotal.add(lineTotal);
        itemsData.push({
          merchantId,
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: qty,
          lineTotal,
        });

        if (product.trackInventory) {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: qty } },
          });
          await tx.stockMovement.create({
            data: {
              merchantId,
              productId: product.id,
              type: 'SALE',
              quantity: -qty,
              reason: 'بيع عبر طلب',
              reference: number,
            },
          });
          // رصد عبور حدّ المخزون المنخفض (لإشعار المالك بعد نجاح المعاملة).
          const newStock = product.stock - qty;
          if (product.stock > product.lowStockThreshold && newStock <= product.lowStockThreshold) {
            lowStockProducts.push({ id: product.id, name: product.name, stock: newStock });
          }
        }
      }

      let discount = new Prisma.Decimal(input.discount && input.discount > 0 ? input.discount : 0);
      if (discount.greaterThan(subtotal)) {
        discount = subtotal; // لا يتجاوز الخصم قيمة الطلب
      }
      const total = subtotal.sub(discount);

      return tx.order.create({
        data: {
          merchantId,
          number,
          status: 'PENDING',
          source: input.source,
          currency,
          subtotal,
          discount,
          total,
          customerId: input.customerId,
          conversationId: input.conversationId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerAddress: input.customerAddress,
          notes: input.notes,
          items: { createMany: { data: itemsData } },
        },
        include: { items: true },
      });
    });

    await this.usage.increment(merchantId, 'ORDER_CREATED');

    // إشعارات (أفضل جهد): المالك بطلب جديد، والعميل بإنشاء طلبه، وتنبيه المخزون المنخفض.
    await this.notifications.newOrder(order).catch(() => undefined);
    await this.notifications.orderStatus(order, 'CREATED').catch(() => undefined);
    for (const p of lowStockProducts) {
      await this.notifications.lowStock(merchantId, p).catch(() => undefined);
    }
    return order;
  }

  async findAll(merchantId: string, query: QueryOrdersDto) {
    const { page, limit, search, status, source } = query;
    const where: Prisma.OrderWhereInput = { merchantId };
    if (status) {
      where.status = status;
    }
    if (source) {
      where.source = source;
    }
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          _count: { select: { items: true } },
          customer: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, limit),
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  /** طلبات عميل معيّن (لأمر /orders في البوت). */
  async listByCustomer(merchantId: string, customerId: string, limit = 8) {
    return this.prisma.order.findMany({
      where: { merchantId, customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { _count: { select: { items: true } } },
    });
  }

  /** أحدث طلب لعميل (لتتبّع الحالة عبر المساعد). */
  async getLatestForCustomer(merchantId: string, customerId: string) {
    return this.prisma.order.findFirst({
      where: { merchantId, customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** طلب عميل محدّد برقمه (مقيّد بالعميل والمتجر للخصوصية). */
  async findForCustomerByNumber(merchantId: string, customerId: string, number: string) {
    return this.prisma.order.findFirst({ where: { merchantId, customerId, number } });
  }

  async findOne(merchantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, merchantId },
      include: { items: true, customer: true },
    });
    if (!order) {
      throw new NotFoundException('الطلب غير موجود');
    }
    return order;
  }

  /** تحديث حالة الطلب، مع إعادة المخزون تلقائيًا عند الإلغاء. */
  async updateStatus(merchantId: string, id: string, status: OrderStatus): Promise<Order> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id, merchantId }, include: { items: true } });
      if (!order) {
        throw new NotFoundException('الطلب غير موجود');
      }

      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        for (const item of order.items) {
          if (!item.productId) {
            continue;
          }
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product?.trackInventory) {
            await tx.product.update({
              where: { id: product.id },
              data: { stock: { increment: item.quantity } },
            });
            await tx.stockMovement.create({
              data: {
                merchantId,
                productId: product.id,
                type: 'RETURN',
                quantity: item.quantity,
                reason: `إلغاء الطلب ${order.number}`,
                reference: order.number,
              },
            });
          }
        }
      }

      return tx.order.update({ where: { id }, data: { status }, include: { items: true } });
    });

    // إشعار العميل بتغيّر حالة طلبه عبر تيليجرام (أفضل جهد).
    await this.notifications.orderStatus(updated, status).catch(() => undefined);
    return updated;
  }

  private generateOrderNumber(): string {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `SM-${ymd}-${rand}`;
  }
}

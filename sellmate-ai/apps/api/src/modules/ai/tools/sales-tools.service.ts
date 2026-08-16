import { Injectable, Logger } from '@nestjs/common';
import { Product } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RetrievalService } from '../../knowledge/retrieval.service';
import { OrdersService } from '../../orders/orders.service';
import { ProductsService } from '../../products/products.service';
import { AiToolSchema, ToolContext } from '../ai.types';

/**
 * سجلّ أدوات مساعد المبيعات. كل أداة تقرأ/تكتب بيانات المتجر الحالي فقط،
 * فتضمن أن المساعد لا يعرف إلا ما هو موجود فعلًا في قاعدة البيانات.
 */
@Injectable()
export class SalesToolsService {
  private readonly logger = new Logger(SalesToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly retrieval: RetrievalService,
    private readonly orders: OrdersService,
  ) {}

  /** مخططات الأدوات المتاحة للنموذج (JSON Schema). */
  getSchemas(allowOrderCreation: boolean): AiToolSchema[] {
    const schemas: AiToolSchema[] = [
      {
        name: 'search_products',
        description:
          'ابحث عن منتجات المتجر المتوفّرة مع فلترة بالسعر والتصنيف والترتيب. استخدمه لاقتراح أفضل الخيارات ضمن ميزانية العميل (مثال: سماعات ألعاب بأقل من 50 عبر maxPrice=50 و sort=price_asc). يعيد الأسعار الحقيقية من قاعدة البيانات فقط.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'وصف المنتج المطلوب (اختياري)' },
            category: { type: 'string', description: 'تصنيف اختياري' },
            minPrice: { type: 'number', description: 'أدنى سعر بعملة المتجر' },
            maxPrice: { type: 'number', description: 'أعلى سعر (سقف ميزانية العميل)' },
            sort: {
              type: 'string',
              enum: ['price_asc', 'price_desc', 'newest'],
              description: 'ترتيب النتائج',
            },
            limit: { type: 'integer', description: 'عدد النتائج (يُفضَّل 3)' },
          },
        },
      },
      {
        name: 'list_products',
        description: 'عرض أحدث منتجات المتجر المتوفّرة عندما لا يحدّد العميل بحثًا معيّنًا.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'integer' } },
        },
      },
      {
        name: 'get_product',
        description: 'جلب تفاصيل منتج محدّد عبر معرّفه (id) بما فيها السعر والمخزون والمواصفات.',
        parameters: {
          type: 'object',
          properties: { productId: { type: 'string' } },
          required: ['productId'],
        },
      },
      {
        name: 'search_knowledge',
        description:
          'ابحث في قاعدة معرفة المتجر: سياسات الشحن والاستبدال والاسترجاع، طرق الدفع، أوقات العمل، معلومات التواصل، شروط البيع، والأسئلة الشائعة. استخدمه لأي سؤال عن سياسات المتجر أو معلوماته العامة. يعيد فقط ما هو مُوثّق في قاعدة المعرفة.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'سؤال العميل أو موضوع الاستعلام' },
            limit: { type: 'integer', description: 'عدد النتائج (افتراضي 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_store_info',
        description: 'جلب المعلومات العامة للمتجر (الاسم، الوصف، العملة، وسيلة التواصل).',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'get_order_status',
        description:
          'اعرض حالة طلب العميل الحالي. مرّر رقم الطلب إن ذكره العميل، وإلا يُعاد أحدث طلب له. يعيد بيانات طلبات هذا العميل فقط.',
        parameters: {
          type: 'object',
          properties: {
            orderNumber: { type: 'string', description: 'رقم الطلب (اختياري)' },
          },
        },
      },
    ];

    if (allowOrderCreation) {
      schemas.push({
        name: 'create_order',
        description:
          'إنشاء طلب فعلي بعد تأكيد العميل. يحسب النظام السعر من قاعدة البيانات ويتحقق من المخزون.',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'قائمة المنتجات المطلوبة',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                },
                required: ['productId', 'quantity'],
              },
            },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            customerAddress: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['items'],
        },
      });
    }

    return schemas;
  }

  /** تنفيذ أداة باسمها ووسائطها ضمن سياق المتجر/المحادثة. */
  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<unknown> {
    try {
      switch (name) {
        case 'search_products': {
          const list = await this.products.searchActive(ctx.merchantId, {
            query: args.query ? String(args.query) : undefined,
            category: args.category ? String(args.category) : undefined,
            minPrice: this.toNumber(args.minPrice),
            maxPrice: this.toNumber(args.maxPrice),
            sort: this.toSort(args.sort),
            limit: this.toLimit(args.limit, 5),
          });
          return {
            count: list.length,
            products: list.map((p) => this.toProductView(p, ctx.currency)),
          };
        }
        case 'list_products': {
          const list = await this.products.listActive(ctx.merchantId, this.toLimit(args.limit, 12));
          return { products: list.map((p) => this.toProductView(p, ctx.currency)) };
        }
        case 'get_product': {
          const product = await this.products.getActive(ctx.merchantId, String(args.productId));
          if (!product) {
            return { error: 'not_found', message: 'لا يوجد منتج بهذا المعرّف' };
          }
          return this.toProductView(product, ctx.currency, true);
        }
        case 'search_knowledge': {
          const chunks = await this.retrieval.retrieve(
            ctx.merchantId,
            String(args.query ?? ''),
            this.toLimit(args.limit, 5),
          );
          return {
            count: chunks.length,
            knowledge: chunks.map((c) => ({
              category: c.category,
              title: c.title,
              content: c.content,
            })),
          };
        }
        case 'get_store_info': {
          const store = await this.prisma.merchant.findUnique({
            where: { id: ctx.merchantId },
            select: { name: true, description: true, currency: true, phone: true },
          });
          return store ?? { error: 'not_found' };
        }
        case 'get_order_status': {
          if (!ctx.customerId) {
            return { error: 'no_customer', message: 'تتبّع الطلب متاح لعملاء تيليجرام فقط' };
          }
          const orderNumber = args.orderNumber ? String(args.orderNumber).trim() : '';
          const order = orderNumber
            ? await this.orders.findForCustomerByNumber(ctx.merchantId, ctx.customerId, orderNumber)
            : await this.orders.getLatestForCustomer(ctx.merchantId, ctx.customerId);
          if (!order) {
            return { error: 'not_found', message: 'لا يوجد طلب مطابق لهذا العميل' };
          }
          return {
            order: {
              number: order.number,
              status: order.status,
              total: order.total.toString(),
              currency: order.currency,
              createdAt: order.createdAt,
            },
          };
        }
        case 'create_order':
          return this.handleCreateOrder(args, ctx);
        default:
          return { error: 'unknown_tool', message: `أداة غير معروفة: ${name}` };
      }
    } catch (err) {
      this.logger.warn(`فشل تنفيذ الأداة ${name}: ${(err as Error).message}`);
      return { error: 'tool_error', message: (err as Error).message };
    }
  }

  private async handleCreateOrder(args: Record<string, unknown>, ctx: ToolContext) {
    if (!ctx.allowOrderCreation) {
      return { error: 'ordering_disabled', message: 'إنشاء الطلبات معطّل لهذا المتجر حاليًا' };
    }
    const rawItems = Array.isArray(args.items) ? (args.items as any[]) : [];
    const items = rawItems
      .map((i) => ({ productId: String(i.productId), quantity: Number(i.quantity) }))
      .filter((i) => i.productId && Number.isInteger(i.quantity) && i.quantity > 0);
    if (!items.length) {
      return { error: 'invalid_items', message: 'لا توجد منتجات صالحة في الطلب' };
    }

    try {
      const order = await this.orders.createFromConversation(ctx.merchantId, {
        items,
        customerId: ctx.customerId,
        conversationId: ctx.conversationId,
        customerName: args.customerName ? String(args.customerName) : undefined,
        customerPhone: args.customerPhone ? String(args.customerPhone) : undefined,
        customerAddress: args.customerAddress ? String(args.customerAddress) : undefined,
        notes: args.notes ? String(args.notes) : undefined,
      });
      const summary = {
        id: order.id,
        number: order.number,
        total: order.total.toString(),
        currency: order.currency,
      };
      ctx.state.createdOrder = summary;
      return { ok: true, order: { ...summary, status: order.status } };
    } catch (err) {
      // نعيد سبب الفشل ليصوغه المساعد للعميل (مثل نقص المخزون)
      return { error: 'order_failed', message: (err as Error).message };
    }
  }

  private toProductView(p: Product, currency: string, detailed = false) {
    const base = {
      id: p.id,
      name: p.name,
      category: p.category ?? undefined,
      price: p.price.toString(),
      oldPrice: p.oldPrice != null ? p.oldPrice.toString() : undefined,
      currency: p.currency ?? currency,
      inStock: p.status === 'ACTIVE' && (!p.trackInventory || p.stock > 0),
      imageUrl: p.imageUrl ?? undefined,
    };
    if (!detailed) {
      return { ...base, description: p.description ?? undefined };
    }
    return {
      ...base,
      stock: p.stock,
      description: p.description ?? undefined,
      attributes: p.attributes,
      tags: p.tags,
    };
  }

  private toLimit(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? Math.min(n, 20) : fallback;
  }

  private toNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }

  private toSort(value: unknown): 'price_asc' | 'price_desc' | 'newest' | undefined {
    return value === 'price_asc' || value === 'price_desc' || value === 'newest' ? value : undefined;
  }
}

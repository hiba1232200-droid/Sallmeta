import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, skipTake } from '../../common/utils/pagination.util';
import { UsageService } from '../subscriptions/usage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/** الحالات الظاهرة للعملاء والمساعد (قابلة للعرض والبيع أو "نفد المخزون"). */
const VISIBLE_STATUSES: ProductStatus[] = ['ACTIVE', 'OUT_OF_STOCK'];

/** خيارات بحث المنتجات المستخدمة من وكيل المبيعات (فلترة بالسعر/التصنيف/الترتيب). */
export interface ProductSearchOptions {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest';
  limit?: number;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  async create(merchantId: string, dto: CreateProductDto): Promise<Product> {
    await this.usage.assertWithinProductLimit(merchantId);
    const stock = dto.stock ?? 0;
    const trackInventory = dto.trackInventory ?? true;
    return this.prisma.product.create({
      data: {
        merchantId,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        sku: dto.sku,
        price: dto.price,
        oldPrice: dto.oldPrice,
        currency: dto.currency,
        stock,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        trackInventory,
        status: this.resolveStatus(dto.status, undefined, trackInventory, stock),
        attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
        imageUrl: dto.imageUrl,
        tags: dto.tags ?? [],
      },
    });
  }

  async findAll(merchantId: string, query: QueryProductsDto) {
    const { page, limit, search, sortBy, sortOrder, category, status, tag, minPrice, maxPrice } =
      query;
    const where: Prisma.ProductWhereInput = { merchantId };
    where.status = status ?? { not: 'ARCHIVED' };
    if (category) {
      where.category = category;
    }
    if (tag) {
      where.tags = { has: tag };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: this.buildOrderBy(sortBy, sortOrder),
        ...skipTake(page, limit),
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findOne(merchantId: string, id: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({ where: { id, merchantId } });
    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }
    return product;
  }

  async update(merchantId: string, id: string, dto: UpdateProductDto): Promise<Product> {
    const existing = await this.findOne(merchantId, id);
    // إعادة احتساب الحالة تلقائيًا عند تغيّر المخزون (دون تجاوز الحالة الصريحة أو اليدوية).
    let status = dto.status;
    if (!status && (dto.stock !== undefined || dto.trackInventory !== undefined)) {
      status = this.resolveStatus(
        undefined,
        existing.status,
        dto.trackInventory ?? existing.trackInventory,
        dto.stock ?? existing.stock,
      );
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        status,
        attributes: dto.attributes as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** حذف ناعم افتراضيًا (أرشفة)، أو حذف نهائي عند permanent=true. */
  async remove(merchantId: string, id: string, permanent = false) {
    await this.findOne(merchantId, id);
    if (permanent) {
      await this.prisma.product.delete({ where: { id } });
      return { success: true, deleted: true };
    }
    await this.prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    return { success: true, archived: true };
  }

  /** قائمة التصنيفات المستخدمة (لعناصر الفلترة في اللوحة). */
  async listCategories(merchantId: string): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { merchantId, category: { not: null }, status: { not: 'ARCHIVED' } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category).filter((c): c is string => !!c);
  }

  // --------- قراءة فقط: مصدر معرفة المساعد (منتجات ظاهرة) ---------

  async searchActive(merchantId: string, options: ProductSearchOptions = {}): Promise<Product[]> {
    const q = options.query?.trim();
    const where: Prisma.ProductWhereInput = { merchantId, status: { in: VISIBLE_STATUSES } };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }
    if (options.category) {
      where.category = { contains: options.category, mode: 'insensitive' };
    }
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      where.price = {};
      if (options.minPrice !== undefined) {
        where.price.gte = options.minPrice;
      }
      if (options.maxPrice !== undefined) {
        where.price.lte = options.maxPrice;
      }
    }
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      options.sort === 'price_asc'
        ? { price: 'asc' }
        : options.sort === 'price_desc'
          ? { price: 'desc' }
          : options.sort === 'newest'
            ? { createdAt: 'desc' }
            : { updatedAt: 'desc' };
    return this.prisma.product.findMany({
      where,
      take: Math.min(options.limit ?? 8, 20),
      orderBy,
    });
  }

  async getActive(merchantId: string, id: string): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where: { id, merchantId, status: { in: VISIBLE_STATUSES } },
    });
  }

  async listActive(merchantId: string, limit = 20): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { merchantId, status: { in: VISIBLE_STATUSES } },
      take: Math.min(limit, 50),
      orderBy: { createdAt: 'desc' },
    });
  }

  async pageActive(
    merchantId: string,
    offset = 0,
    limit = 6,
  ): Promise<{ items: Product[]; total: number }> {
    const where: Prisma.ProductWhereInput = { merchantId, status: { in: VISIBLE_STATUSES } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  /** يحسم حالة المنتج: يحترم الحالة الصريحة واليدوية، ويضبط ACTIVE↔OUT_OF_STOCK حسب المخزون. */
  private resolveStatus(
    explicit: ProductStatus | undefined,
    current: ProductStatus | undefined,
    trackInventory: boolean,
    stock: number,
  ): ProductStatus {
    if (explicit) {
      return explicit;
    }
    if (current === 'HIDDEN' || current === 'ARCHIVED') {
      return current;
    }
    if (trackInventory && stock <= 0) {
      return 'OUT_OF_STOCK';
    }
    return 'ACTIVE';
  }

  private buildOrderBy(
    sortBy: string | undefined,
    sortOrder: 'asc' | 'desc' | undefined,
  ): Prisma.ProductOrderByWithRelationInput {
    const allowed = ['createdAt', 'updatedAt', 'name', 'price', 'stock'];
    const field = allowed.includes(sortBy ?? '') ? (sortBy as string) : 'createdAt';
    return { [field]: sortOrder ?? 'desc' } as Prisma.ProductOrderByWithRelationInput;
  }
}

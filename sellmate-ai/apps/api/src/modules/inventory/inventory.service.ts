import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, skipTake } from '../../common/utils/pagination.util';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** تعديل مخزون منتج ضمن معاملة ذرّية مع تسجيل الحركة. */
  async adjustStock(merchantId: string, dto: AdjustStockDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: dto.productId, merchantId },
      });
      if (!product) {
        throw new NotFoundException('المنتج غير موجود');
      }
      const newStock = product.stock + dto.quantity;
      if (newStock < 0) {
        throw new BadRequestException('المخزون لا يكفي لإتمام هذه العملية');
      }
      // ضبط الحالة تلقائيًا بين ACTIVE و OUT_OF_STOCK (دون تجاوز HIDDEN/ARCHIVED).
      let status = product.status;
      if (
        product.trackInventory &&
        (product.status === 'ACTIVE' || product.status === 'OUT_OF_STOCK')
      ) {
        status = newStock <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
      }
      const updated = await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock, status },
      });
      const movement = await tx.stockMovement.create({
        data: {
          merchantId,
          productId: product.id,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          createdByUserId: userId,
        },
      });
      return { product: updated, movement };
    });
  }

  async listMovements(merchantId: string, query: QueryMovementsDto) {
    const { page, limit, productId } = query;
    const where = { merchantId, ...(productId ? { productId } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, limit),
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }
}

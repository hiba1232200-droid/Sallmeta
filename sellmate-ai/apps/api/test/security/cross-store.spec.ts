import { NotFoundException } from '@nestjs/common';
import { ProductsService } from '../../src/modules/products/products.service';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { createPrismaMock, PrismaMock } from '../helpers/prisma.mock';
import { makeProduct, makeOrder } from '../helpers/factories';

/**
 * عزل المتاجر: كل استعلام محصور بـ merchantId المستخرَج من الرمز.
 * لا يمكن للمتجر A الوصول إلى بيانات المتجر B — لأن استعلام B (بمعرّف A) يعيد null.
 */
describe('Cross-store isolation (Store A cannot access Store B data)', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('products.findOne scopes by merchantId and returns NotFound for another store\'s product', async () => {
    const products = new ProductsService(prisma as any, { assertWithinProductLimit: jest.fn() } as any);
    prisma.product.findFirst.mockResolvedValue(null); // منتج المتجر B غير مرئي للمتجر A
    await expect(products.findOne('store-A', 'product-owned-by-B')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 'product-owned-by-B', merchantId: 'store-A' },
    });
  });

  it('a store only ever sees its own product', async () => {
    const products = new ProductsService(prisma as any, { assertWithinProductLimit: jest.fn() } as any);
    prisma.product.findFirst.mockResolvedValue(makeProduct({ merchantId: 'store-A' }));
    const p = await products.findOne('store-A', 'prod-1');
    expect(p.merchantId).toBe('store-A');
  });

  it('orders.findOne scopes by merchantId (no cross-store order reads)', async () => {
    const orders = new OrdersService(
      prisma as any,
      { increment: jest.fn() } as any,
      { assertFeature: jest.fn() } as any,
      { newOrder: jest.fn(), orderStatus: jest.fn(), lowStock: jest.fn() } as any,
    );
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(orders.findOne('store-A', 'order-of-B')).rejects.toBeInstanceOf(NotFoundException);
    const where = prisma.order.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'order-of-B', merchantId: 'store-A' });
  });

  it('updating another store\'s order is impossible (scoped lookup returns null → NotFound)', async () => {
    const orders = new OrdersService(
      prisma as any,
      { increment: jest.fn() } as any,
      { assertFeature: jest.fn() } as any,
      { newOrder: jest.fn(), orderStatus: jest.fn(), lowStock: jest.fn() } as any,
    );
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(orders.updateStatus('store-A', 'order-of-B', 'COMPLETED' as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

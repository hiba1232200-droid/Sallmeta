import { NotFoundException } from '@nestjs/common';
import { ProductsService } from '../../src/modules/products/products.service';
import { createPrismaMock, PrismaMock } from '../helpers/prisma.mock';
import { makeProduct } from '../helpers/factories';

describe('ProductsService (Products)', () => {
  let prisma: PrismaMock;
  let usage: any;
  let service: ProductsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    usage = { assertWithinProductLimit: jest.fn().mockResolvedValue(undefined) };
    service = new ProductsService(prisma as any, usage);
  });

  it('enforces the plan product limit before creating', async () => {
    usage.assertWithinProductLimit.mockRejectedValue(new Error('limit'));
    await expect(service.create('store-A', { name: 'X', price: 10 } as any)).rejects.toThrow('limit');
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('creates a product with a default low-stock threshold', async () => {
    prisma.product.create.mockResolvedValue(makeProduct());
    await service.create('store-A', { name: 'Headset', price: 45, stock: 10 } as any);
    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ merchantId: 'store-A', lowStockThreshold: 5 }),
      }),
    );
  });

  it('scopes list queries to the current store', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);
    prisma.product.count.mockResolvedValue(1);
    await service.findAll('store-A', { page: 1, limit: 20 } as any);
    const call = prisma.product.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ merchantId: 'store-A' });
  });

  it('throws NotFound when updating a product that is not in this store', async () => {
    prisma.product.findFirst.mockResolvedValue(null); // منتج متجر آخر → غير موجود لهذا المتجر
    await expect(service.update('store-A', 'prod-of-B', { name: 'x' } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('archives (soft-delete) by default and hard-deletes only when permanent', async () => {
    prisma.product.findFirst.mockResolvedValue(makeProduct());
    prisma.product.update.mockResolvedValue(makeProduct({ status: 'ARCHIVED' }));
    const soft = await service.remove('store-A', 'prod-1');
    expect(soft).toMatchObject({ archived: true });
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ARCHIVED' } }),
    );

    prisma.product.delete.mockResolvedValue(makeProduct());
    const hard = await service.remove('store-A', 'prod-1', true);
    expect(hard).toMatchObject({ deleted: true });
    expect(prisma.product.delete).toHaveBeenCalled();
  });
});

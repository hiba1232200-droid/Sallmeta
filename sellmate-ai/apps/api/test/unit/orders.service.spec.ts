import { BadRequestException } from '@nestjs/common';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { createPrismaMock, PrismaMock } from '../helpers/prisma.mock';
import { makeMerchant, makeProduct, makeOrder, D } from '../helpers/factories';

describe('OrdersService (Orders)', () => {
  let prisma: PrismaMock;
  let usage: any;
  let subscriptions: any;
  let notifications: any;
  let service: OrdersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    usage = { increment: jest.fn().mockResolvedValue(undefined) };
    subscriptions = { assertFeature: jest.fn().mockResolvedValue(undefined) };
    notifications = {
      newOrder: jest.fn().mockResolvedValue(undefined),
      orderStatus: jest.fn().mockResolvedValue(undefined),
      lowStock: jest.fn().mockResolvedValue(undefined),
    };
    service = new OrdersService(prisma as any, usage, subscriptions, notifications);
    prisma.merchant.findUnique.mockResolvedValue(makeMerchant());
  });

  it('rejects an empty order', async () => {
    await expect(service.createOrder('store-A', { items: [], source: 'DASHBOARD' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires the "orders" feature (subscription gate)', async () => {
    subscriptions.assertFeature.mockRejectedValue(new BadRequestException('feature'));
    await expect(
      service.createOrder('store-A', { items: [{ productId: 'prod-1', quantity: 1 }], source: 'DASHBOARD' } as any),
    ).rejects.toThrow('feature');
  });

  it('computes totals from DB prices only — never trusts client input', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct({ id: 'prod-1', price: D(45), stock: 10 })]);
    prisma.product.update.mockResolvedValue({});
    prisma.stockMovement.create.mockResolvedValue({});
    prisma.order.create.mockResolvedValue(makeOrder({ total: D(90) }));

    await service.createOrder('store-A', {
      items: [{ productId: 'prod-1', quantity: 2, price: 1 }], // سعر العميل 1$ يجب تجاهله
      source: 'DASHBOARD',
    } as any);

    const created = prisma.order.create.mock.calls[0][0].data;
    expect(created.subtotal.toString()).toBe('90'); // 45 × 2 من قاعدة البيانات
    expect(usage.increment).toHaveBeenCalledWith('store-A', 'ORDER_CREATED');
    expect(notifications.newOrder).toHaveBeenCalled();
    expect(notifications.orderStatus).toHaveBeenCalledWith(expect.anything(), 'CREATED');
  });

  it('blocks orders that exceed available stock', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct({ id: 'prod-1', stock: 1, trackInventory: true })]);
    await expect(
      service.createOrder('store-A', { items: [{ productId: 'prod-1', quantity: 5 }], source: 'DASHBOARD' } as any),
    ).rejects.toThrow(/غير كافية/);
  });

  it('caps discount at the order subtotal (no negative totals)', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct({ id: 'prod-1', price: D(45), stock: 10 })]);
    prisma.product.update.mockResolvedValue({});
    prisma.stockMovement.create.mockResolvedValue({});
    prisma.order.create.mockResolvedValue(makeOrder());
    await service.createOrder('store-A', {
      items: [{ productId: 'prod-1', quantity: 1 }],
      discount: 999,
      source: 'DASHBOARD',
    } as any);
    const data = prisma.order.create.mock.calls[0][0].data;
    expect(data.total.toString()).toBe('0'); // الخصم لا يتجاوز 45 → الإجمالي 0
  });

  it('restocks items and notifies the customer when an order is cancelled', async () => {
    const order = makeOrder({ status: 'CONFIRMED', items: [{ productId: 'prod-1', quantity: 2 }] });
    prisma.order.findFirst.mockResolvedValue(order);
    prisma.product.findUnique.mockResolvedValue(makeProduct({ trackInventory: true }));
    prisma.product.update.mockResolvedValue({});
    prisma.stockMovement.create.mockResolvedValue({});
    prisma.order.update.mockResolvedValue(makeOrder({ status: 'CANCELLED' }));

    await service.updateStatus('store-A', 'order-1', 'CANCELLED' as any);

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stock: { increment: 2 } } }),
    );
    expect(notifications.orderStatus).toHaveBeenCalledWith(expect.anything(), 'CANCELLED');
  });
});

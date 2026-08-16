import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OrdersPublicController } from '../../src/modules/public-api/orders-public.controller';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { makeOrder } from '../helpers/factories';

/** تكامل إنشاء الطلب عبر HTTP: التحقق من الإدخال + التفويض + التفويض للخدمة. */
describe('POST /api/orders (integration)', () => {
  let app: INestApplication;
  const orders = { createFromDashboard: jest.fn() };
  let currentRole = 'OWNER';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [OrdersPublicController],
      providers: [
        { provide: OrdersService, useValue: orders },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api'); // يطابق البادئة العامة في الإنتاج
    // نحقن المستخدم المُصادَق قبل الحُرّاس (يحاكي حارس JWT)
    app.use((req: any, _res: any, next: any) => {
      req.user = { userId: 'u1', merchantId: 'store-A', role: currentRole, email: 'o@store.test' };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => orders.createFromDashboard.mockReset());

  it('creates an order for a valid payload and scopes it to the caller\'s store', async () => {
    currentRole = 'OWNER';
    orders.createFromDashboard.mockResolvedValue(makeOrder());
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({ items: [{ productId: 'prod-1', quantity: 2 }] })
      .expect(201);
    expect(orders.createFromDashboard).toHaveBeenCalledWith(
      'store-A',
      expect.objectContaining({ items: [{ productId: 'prod-1', quantity: 2 }] }),
    );
  });

  it('rejects an invalid payload (no items) with 400 — service never called', async () => {
    currentRole = 'OWNER';
    await request(app.getHttpServer()).post('/api/orders').send({ items: [] }).expect(400);
    // مصفوفة فارغة/مفقودة أو كمية غير صالحة تُرفض قبل بلوغ الخدمة
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({ items: [{ productId: 'p', quantity: -5 }] })
      .expect(400);
    expect(orders.createFromDashboard).not.toHaveBeenCalled();
  });

  it('strips unknown/injected fields via whitelist validation', async () => {
    currentRole = 'OWNER';
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({ items: [{ productId: 'p', quantity: 1 }], hacker: true })
      .expect(400);
  });
});

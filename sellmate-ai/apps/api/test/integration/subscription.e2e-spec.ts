import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SubscriptionPublicController } from '../../src/modules/public-api/subscription-public.controller';
import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { RolesGuard } from '../../src/common/guards/roles.guard';

/** تكامل الاشتراك عبر HTTP: القراءة متاحة، وتغيير الفوترة (إلغاء) لـ OWNER فقط. */
describe('/api/subscription (integration)', () => {
  let app: INestApplication;
  const subscriptions = {
    getForMerchant: jest.fn().mockResolvedValue({ subscription: {}, plan: {} }),
    toPublic: jest.fn().mockReturnValue({ status: 'ACTIVE', active: true }),
    cancel: jest.fn().mockResolvedValue({ subscription: {}, plan: {} }),
  };
  const payments = { createSubscriptionCheckout: jest.fn() };
  let currentRole = 'OWNER';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [SubscriptionPublicController],
      providers: [
        { provide: SubscriptionsService, useValue: subscriptions },
        { provide: PaymentsService, useValue: payments },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api'); // يطابق البادئة العامة في الإنتاج
    app.use((req: any, _res: any, next: any) => {
      req.user = { userId: 'u1', merchantId: 'store-A', role: currentRole, email: 'o@store.test' };
      next();
    });
    await app.init();
  });

  afterAll(async () => app.close());

  it('returns the current subscription (any authenticated role)', async () => {
    currentRole = 'STAFF';
    await request(app.getHttpServer()).get('/api/subscription').expect(200).expect({ status: 'ACTIVE', active: true });
    expect(subscriptions.getForMerchant).toHaveBeenCalledWith('store-A');
  });

  it('BLOCKS a STAFF member from cancelling (billing) with 403', async () => {
    currentRole = 'STAFF';
    await request(app.getHttpServer()).post('/api/subscription/cancel').expect(403);
    expect(subscriptions.cancel).not.toHaveBeenCalled();
  });

  it('allows the OWNER to cancel the subscription', async () => {
    currentRole = 'OWNER';
    await request(app.getHttpServer()).post('/api/subscription/cancel').expect(201);
    expect(subscriptions.cancel).toHaveBeenCalledWith('store-A');
  });
});

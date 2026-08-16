import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { WebhooksPublicController } from '../../src/modules/public-api/webhooks-public.controller';
import { TelegramService } from '../../src/modules/telegram/telegram.service';

/**
 * تكامل ويبهوك تيليجرام على مستوى HTTP.
 * السرّ يُتحقّق داخل TelegramService.handleUpdate — هنا نتحقق من عقد المسار والتفويض.
 */
describe('POST /api/webhooks/telegram (integration)', () => {
  let app: INestApplication;
  const telegram = { handleUpdate: jest.fn() };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [WebhooksPublicController],
      providers: [
        { provide: TelegramService, useValue: telegram },
        // لا حارس JWT عام في هذه الوحدة المعزولة؛ نضيف حارسًا سامحًا لتأكيد الوصول العام.
        { provide: APP_GUARD, useValue: { canActivate: () => true } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api'); // يطابق البادئة العامة في الإنتاج
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => telegram.handleUpdate.mockReset());

  it('forwards merchantId (query) + secret (header) + body to the service and returns ok', async () => {
    telegram.handleUpdate.mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .post('/api/webhooks/telegram?merchantId=store-A')
      .set('x-telegram-bot-api-secret-token', 'the-secret')
      .send({ message: { text: 'hi' } })
      .expect(200)
      .expect({ ok: true });

    expect(telegram.handleUpdate).toHaveBeenCalledWith(
      'store-A',
      'the-secret',
      expect.objectContaining({ message: expect.any(Object) }),
    );
  });

  it('returns 401 when the service rejects an invalid secret', async () => {
    telegram.handleUpdate.mockRejectedValue(new UnauthorizedException('سرّ webhook غير صحيح'));
    await request(app.getHttpServer())
      .post('/api/webhooks/telegram?merchantId=store-A')
      .set('x-telegram-bot-api-secret-token', 'wrong')
      .send({ message: {} })
      .expect(401);
  });
});

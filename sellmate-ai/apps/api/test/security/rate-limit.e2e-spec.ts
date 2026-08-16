import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 2 }])],
  controllers: [PingController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class RateTestModule {}

describe('Rate limiting (ThrottlerGuard returns 429 over the limit)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [RateTestModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows up to the limit, then blocks with HTTP 429', async () => {
    const server = app.getHttpServer();
    await request(server).get('/ping').expect(200);
    await request(server).get('/ping').expect(200);
    await request(server).get('/ping').expect(429); // تجاوز الحد
  });
});

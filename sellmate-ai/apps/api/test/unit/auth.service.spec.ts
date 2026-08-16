import { ConflictException, UnauthorizedException } from '@nestjs/common';

// نُبدّل مكتبة argon2 الأصلية بدوال وهمية (تُثبَّت فعليًا عند تشغيل الاختبارات).
jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-pw'),
  verify: jest.fn(),
  Algorithm: { Argon2d: 0, Argon2i: 1, Argon2id: 2 },
}));

import { hash, verify } from '@node-rs/argon2';
import { AuthService } from '../../src/modules/auth/auth.service';
import { createPrismaMock, PrismaMock } from '../helpers/prisma.mock';
import { makeUser, makeMerchant, makePlan } from '../helpers/factories';

describe('AuthService (Authentication)', () => {
  let prisma: PrismaMock;
  let jwt: any;
  let config: any;
  let plans: any;
  let audit: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token'), verifyAsync: jest.fn() };
    config = {
      get: jest.fn((k: string) =>
        ({
          'jwt.accessSecret': 'a-secret',
          'jwt.refreshSecret': 'r-secret',
          'jwt.accessTtl': 900,
          'jwt.refreshTtl': 604800,
          'platform.adminEmails': ['admin@sellmate.ai'],
        })[k],
      ),
    };
    plans = { getByTier: jest.fn().mockResolvedValue(makePlan({ tier: 'STARTER', id: 'plan-starter' })) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(prisma as any, jwt, config, plans, audit);
    (verify as jest.Mock).mockReset();
    (hash as jest.Mock).mockClear();
  });

  describe('register', () => {
    it('rejects a duplicate email with 409', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      await expect(
        service.register({ storeName: 'S', name: 'N', email: 'owner@store.test', password: 'Passw0rd1' } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('hashes the password with tuned argon2 options and issues tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no existing user, and unique slug
      prisma.merchant.findUnique.mockResolvedValue(null);
      const merchant = makeMerchant();
      const user = makeUser();
      prisma.merchant.create.mockResolvedValue(merchant);
      prisma.user.create.mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt' });

      const res = await service.register({
        storeName: 'Store A',
        name: 'Owner',
        email: 'owner@store.test',
        password: 'Passw0rd1',
      } as any);

      expect(hash).toHaveBeenCalledWith('Passw0rd1', expect.objectContaining({ memoryCost: 19456 }));
      expect(res.accessToken).toBe('jwt-token');
      expect(res.merchant).toMatchObject({ id: merchant.id });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_REGISTER' }));
    });
  });

  describe('login', () => {
    it('rejects wrong password with a generic message and logs a failed attempt', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ merchant: { isActive: true } }));
      (verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'owner@store.test', password: 'bad' } as any)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_LOGIN_FAILED' }));
    });

    it('runs a dummy verify when the user does not exist (timing-safe)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'ghost@x.test', password: 'x' } as any)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // تُستدعى verify دائمًا (على تجزئة وهمية) لتوحيد الزمن
      expect(verify).toHaveBeenCalled();
    });

    it('rejects an inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ isActive: false, merchant: { isActive: true } }));
      (verify as jest.Mock).mockResolvedValue(true);
      await expect(service.login({ email: 'owner@store.test', password: 'x' } as any)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects login when the store is suspended', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ merchant: { isActive: false } }));
      (verify as jest.Mock).mockResolvedValue(true);
      await expect(service.login({ email: 'owner@store.test', password: 'ok' } as any)).rejects.toThrow(
        /تم تعليق/,
      );
    });

    it('succeeds with valid credentials and records success', async () => {
      const user = makeUser({ merchant: { isActive: true } });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt' });
      (verify as jest.Mock).mockResolvedValue(true);

      const res = await service.login({ email: 'owner@store.test', password: 'Passw0rd1' } as any);

      expect(res.accessToken).toBe('jwt-token');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastLoginAt: expect.any(Date) }) }),
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_LOGIN_SUCCESS' }));
    });
  });
});

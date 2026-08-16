import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';

describe('JwtStrategy (Invalid tokens)', () => {
  const config = { get: jest.fn().mockReturnValue('access-secret') };
  const strategy = new JwtStrategy(config as any);

  it('accepts a valid access-token payload and maps it to an AuthUser', () => {
    const user = strategy.validate({
      sub: 'u1',
      merchantId: 'store-A',
      role: 'OWNER',
      email: 'o@store.test',
      type: 'access',
    } as any);
    expect(user).toEqual({ userId: 'u1', merchantId: 'store-A', role: 'OWNER', email: 'o@store.test' });
  });

  it('rejects a refresh token used as an access token', () => {
    expect(() =>
      strategy.validate({ sub: 'u1', merchantId: 'store-A', role: 'OWNER', email: 'e', type: 'refresh' } as any),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a payload with a missing/invalid type', () => {
    expect(() => strategy.validate({ sub: 'u1', type: undefined } as any)).toThrow(UnauthorizedException);
  });
});

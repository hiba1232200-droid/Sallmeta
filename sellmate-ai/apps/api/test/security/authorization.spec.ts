import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { PlatformAdminGuard } from '../../src/common/guards/platform-admin.guard';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';
import { SubscriptionPublicController } from '../../src/modules/public-api/subscription-public.controller';
import { makeContext } from '../helpers/factories';

describe('RolesGuard (Authorization / Unauthorized access)', () => {
  const guard = new RolesGuard(new Reflector());

  function ctxFor(role: string | undefined, required: string[]) {
    const handler = function h() {};
    Reflect.defineMetadata(ROLES_KEY, required, handler);
    return makeContext(role ? { role, userId: 'u', merchantId: 'store-A', email: 'e' } : undefined, { handler });
  }

  it('allows a handler with no @Roles requirement', () => {
    const handler = function h() {};
    const ctx = makeContext({ role: 'STAFF' }, { handler });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a user whose role is permitted', () => {
    expect(guard.canActivate(ctxFor('OWNER', ['OWNER', 'ADMIN']))).toBe(true);
  });

  it('denies a user whose role is not permitted', () => {
    expect(() => guard.canActivate(ctxFor('STAFF', ['OWNER', 'ADMIN']))).toThrow(ForbiddenException);
  });

  it('denies an unauthenticated request', () => {
    expect(() => guard.canActivate(ctxFor(undefined, ['OWNER']))).toThrow(ForbiddenException);
  });

  it('Staff CANNOT modify billing — subscription change/cancel is OWNER-only', () => {
    const reflector = new Reflector();
    const checkoutRoles = reflector.get(ROLES_KEY, SubscriptionPublicController.prototype.checkout);
    const cancelRoles = reflector.get(ROLES_KEY, SubscriptionPublicController.prototype.cancel);
    expect(checkoutRoles).toEqual(['OWNER']);
    expect(cancelRoles).toEqual(['OWNER']);

    // وحارس الأدوار يمنع STAFF فعليًا على متطلّب OWNER
    expect(() => guard.canActivate(ctxFor('STAFF', ['OWNER']))).toThrow(ForbiddenException);
  });
});

describe('PlatformAdminGuard (platform-level access)', () => {
  const config = { get: jest.fn().mockReturnValue(['admin@sellmate.ai']) };
  const guard = new PlatformAdminGuard(config as any);

  it('allows a platform admin email', () => {
    const ctx = makeContext({ email: 'admin@sellmate.ai', role: 'OWNER' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies a non-admin (even a store OWNER)', () => {
    const ctx = makeContext({ email: 'owner@store.test', role: 'OWNER' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('denies an unauthenticated request', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

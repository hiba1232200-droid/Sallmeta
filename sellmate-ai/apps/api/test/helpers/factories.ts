import { Prisma } from '@prisma/client';
import type { ExecutionContext } from '@nestjs/common';

/** بنّاؤو كيانات وهمية للاختبارات (قيم افتراضية قابلة للتجاوز). */

export const D = (n: number) => new Prisma.Decimal(n);

export function makeMerchant(over: Record<string, any> = {}) {
  return {
    id: 'store-A',
    name: 'Store A',
    slug: 'store-a',
    email: 'a@store.test',
    currency: 'USD',
    locale: 'ar',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...over,
  };
}

export function makeUser(over: Record<string, any> = {}) {
  return {
    id: 'user-1',
    merchantId: 'store-A',
    email: 'owner@store.test',
    name: 'Owner',
    passwordHash: 'hashed',
    role: 'OWNER',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01'),
    ...over,
  };
}

export function makeProduct(over: Record<string, any> = {}) {
  return {
    id: 'prod-1',
    merchantId: 'store-A',
    name: 'Gaming Headset',
    description: null,
    category: 'audio',
    price: D(45),
    oldPrice: null,
    currency: 'USD',
    stock: 10,
    lowStockThreshold: 5,
    trackInventory: true,
    status: 'ACTIVE',
    attributes: {},
    imageUrl: null,
    tags: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...over,
  };
}

export function makePlan(over: Record<string, any> = {}) {
  return {
    id: 'plan-free',
    tier: 'FREE',
    name: 'مجاني',
    priceMonthly: D(0),
    currency: 'USD',
    monthlyMessageLimit: 100,
    productLimit: 50,
    staffLimit: 1,
    features: { basicDashboard: true },
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...over,
  };
}

export function makeSubscription(over: Record<string, any> = {}) {
  return {
    id: 'sub-1',
    merchantId: 'store-A',
    planId: 'plan-free',
    status: 'ACTIVE',
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2999-01-01'),
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...over,
  };
}

export function makeOrder(over: Record<string, any> = {}) {
  return {
    id: 'order-1',
    merchantId: 'store-A',
    customerId: 'cust-1',
    conversationId: null,
    number: 'SM-20260101-ABCDE',
    status: 'PENDING',
    source: 'DASHBOARD',
    currency: 'USD',
    subtotal: D(45),
    discount: D(0),
    total: D(45),
    customerName: 'Sami',
    items: [],
    createdAt: new Date('2026-01-01'),
    ...over,
  };
}

export function makeCustomer(over: Record<string, any> = {}) {
  return {
    id: 'cust-1',
    merchantId: 'store-A',
    telegramId: BigInt(123456),
    username: 'sami',
    firstName: 'Sami',
    lastName: null,
    lastSeenAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    ...over,
  };
}

/** سياق تنفيذ وهمي للحُرّاس (يحمل request.user والـ handler/class للـ Reflector). */
export function makeContext(
  user: Record<string, any> | undefined,
  meta: { handler?: any; cls?: any; headers?: Record<string, string> } = {},
): ExecutionContext {
  const req = { user, headers: meta.headers ?? {}, ip: '127.0.0.1' };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
    }),
    getHandler: () => meta.handler ?? function handler() {},
    getClass: () => meta.cls ?? class Ctrl {},
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

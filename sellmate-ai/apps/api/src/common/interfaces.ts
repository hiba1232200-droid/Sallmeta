import { UserRole } from '@prisma/client';

/**
 * الحمولة المخزّنة داخل الـ JWT.
 */
export interface JwtPayload {
  sub: string; // userId
  merchantId: string;
  role: UserRole;
  email: string;
  type: 'access' | 'refresh';
}

/**
 * المستخدم المُصادَق عليه المرفق بالطلب (request.user).
 */
export interface AuthUser {
  userId: string;
  merchantId: string;
  role: UserRole;
  email: string;
}

/**
 * غلاف موحّد لنتائج التصفّح (pagination).
 */
export interface Paginated<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

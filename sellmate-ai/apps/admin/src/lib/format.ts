export function formatMoney(amount: string | number, currency = 'USD'): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
}

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  TRIALING: 'تجريبي',
  ACTIVE: 'فعّال',
  PAST_DUE: 'متأخر السداد',
  CANCELLED: 'ملغى',
  EXPIRED: 'منتهٍ',
};

export const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  TRIALING: 'blue',
  ACTIVE: 'green',
  PAST_DUE: 'amber',
  CANCELLED: 'red',
  EXPIRED: 'red',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  CONFIRMED: 'مؤكّد',
  PROCESSING: 'قيد التجهيز',
  SHIPPED: 'تم الشحن',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
};

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'مالك',
  ADMIN: 'مدير',
  STAFF: 'موظف',
};

export const PLAN_TIERS = ['FREE', 'STARTER', 'PRO', 'BUSINESS'];
export const SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'];

export function limitText(v: number | undefined, unit: string): string {
  if (v === undefined || v === null) return '—';
  return v < 0 ? `غير محدود` : `${v} ${unit}`;
}

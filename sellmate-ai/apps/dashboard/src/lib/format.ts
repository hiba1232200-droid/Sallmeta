export function formatMoney(amount: string | number, currency = 'USD'): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  return `${n.toLocaleString('ar', { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  CONFIRMED: 'مؤكد',
  PROCESSING: 'قيد التجهيز',
  SHIPPED: 'تم الشحن',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'amber',
  CONFIRMED: 'blue',
  PROCESSING: 'blue',
  SHIPPED: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعّال',
  OUT_OF_STOCK: 'نفد المخزون',
  HIDDEN: 'مخفي',
  ARCHIVED: 'مؤرشف',
};

export const PRODUCT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  OUT_OF_STOCK: 'amber',
  HIDDEN: 'slate',
  ARCHIVED: 'red',
};

export const PRODUCT_STATUSES = ['ACTIVE', 'OUT_OF_STOCK', 'HIDDEN', 'ARCHIVED'];

export const CONVERSATION_STATUS_LABELS: Record<string, string> = {
  AI_ACTIVE: 'المساعد نشط',
  WAITING_FOR_HUMAN: 'بانتظار موظف',
  HUMAN_ACTIVE: 'موظف يتولّى',
  CLOSED: 'مغلقة',
};

export const CONVERSATION_STATUS_COLORS: Record<string, string> = {
  AI_ACTIVE: 'blue',
  WAITING_FOR_HUMAN: 'amber',
  HUMAN_ACTIVE: 'green',
  CLOSED: 'slate',
};

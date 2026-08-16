/**
 * تجريد مزوّد الدفع — لا ربط hard-coded بمزوّد واحد.
 * أضِف مزوّدًا بإنشاء صنف يحقّق PaymentProvider وسطر في المصنع (factory).
 */

export const PAYMENT_PROVIDER_TOKEN = 'PAYMENT_PROVIDER_TOKEN';

export interface CheckoutSessionInput {
  merchantId: string;
  planTier: string;
  productName: string;
  amount: number; // بالوحدة الصغرى للعملة (مثال: سنت)
  currency: string;
  interval: 'month' | 'year';
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
}

export interface PaymentWebhookEvent {
  type: string;
  data: any;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>;
  verifyAndParseWebhook(payload: Buffer | string, signature: string): Promise<PaymentWebhookEvent>;
}

import { AiResponseValidator } from '../../src/modules/ai/ai-response.validator';
import { createPrismaMock, PrismaMock } from '../helpers/prisma.mock';
import { D } from '../helpers/factories';

describe('AiResponseValidator (AI validation / anti-hallucination)', () => {
  let prisma: PrismaMock;
  let validator: AiResponseValidator;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.product.findMany.mockResolvedValue([
      { price: D(45), oldPrice: null },
      { price: D(39), oldPrice: D(50) },
    ]);
    prisma.faq.findMany.mockResolvedValue([]);
    validator = new AiResponseValidator(prisma as any);
  });

  it('accepts a reply that contains no price claims', async () => {
    const r = await validator.validate({
      merchantId: 'store-A',
      currency: 'USD',
      reply: 'أهلًا! كيف أساعدك اليوم؟',
    });
    expect(r.ok).toBe(true);
  });

  it('accepts a reply whose prices are grounded in the catalog', async () => {
    const r = await validator.validate({
      merchantId: 'store-A',
      currency: 'USD',
      reply: 'السماعة متوفرة بسعر 45$ والأخرى بـ 39$.',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects a reply with an invented (ungrounded) price', async () => {
    const r = await validator.validate({
      merchantId: 'store-A',
      currency: 'USD',
      reply: 'عرض خاص لك اليوم بسعر 19$ فقط!',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/غير مؤصَّل/);
  });

  it('normalizes Arabic-Indic digits before validating', async () => {
    const r = await validator.validate({
      merchantId: 'store-A',
      currency: 'USD',
      reply: 'السعر ٤٥ دولار', // ٤٥ = 45 (مؤصَّل)
    });
    expect(r.ok).toBe(true);
  });

  it('grounds the total of a freshly created order', async () => {
    const r = await validator.validate({
      merchantId: 'store-A',
      currency: 'USD',
      reply: 'تم إنشاء طلبك، الإجمالي 84$.',
      createdOrder: { total: '84' },
    });
    expect(r.ok).toBe(true);
  });
});

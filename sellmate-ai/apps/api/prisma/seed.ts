/**
 * بذور قاعدة البيانات.
 * - خطط الاشتراك: إعدادات تشغيلية حقيقية (مطلوبة في الإنتاج).
 * - متجر تجريبي: للاختبار المحلي فقط، خلف SEED_DEMO=true (مطفأ افتراضيًا) احترامًا
 *   لشرط عدم استخدام بيانات وهمية في النسخة النهائية.
 *
 * التشغيل:  npm run db:seed        (خطط فقط)
 *          SEED_DEMO=true npm run db:seed   (خطط + متجر تجريبي محلي)
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const PLANS = [
  { tier: 'FREE' as const, name: 'مجاني', priceMonthly: 0, monthlyMessageLimit: 100, productLimit: 20 },
  { tier: 'STARTER' as const, name: 'المبتدئ', priceMonthly: 19, monthlyMessageLimit: 1000, productLimit: 100 },
  { tier: 'PRO' as const, name: 'الاحترافي', priceMonthly: 49, monthlyMessageLimit: 5000, productLimit: 500 },
  { tier: 'BUSINESS' as const, name: 'الأعمال', priceMonthly: 99, monthlyMessageLimit: -1, productLimit: -1 },
];

async function seedPlans() {
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { tier: p.tier },
      update: {
        name: p.name,
        priceMonthly: new Prisma.Decimal(p.priceMonthly),
        monthlyMessageLimit: p.monthlyMessageLimit,
        productLimit: p.productLimit,
      },
      create: {
        tier: p.tier,
        name: p.name,
        priceMonthly: new Prisma.Decimal(p.priceMonthly),
        monthlyMessageLimit: p.monthlyMessageLimit,
        productLimit: p.productLimit,
      },
    });
  }
  console.log(`✔ تم تجهيز ${PLANS.length} خطط اشتراك`);
}

async function seedDemo() {
  const email = 'owner@demo.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('ℹ︎ المتجر التجريبي موجود مسبقًا');
    return;
  }
  const starter = await prisma.plan.findUniqueOrThrow({ where: { tier: 'STARTER' } });
  const passwordHash = await hash('demo12345');
  const now = new Date();

  const merchant = await prisma.merchant.create({
    data: {
      name: 'متجر تجريبي',
      slug: 'demo-store',
      currency: 'USD',
      description: 'متجر تجريبي للاختبار المحلي.',
      aiSettings: { create: { assistantName: 'مساعد المتجر التجريبي' } },
      subscription: {
        create: {
          planId: starter.id,
          status: 'TRIALING',
          trialEndsAt: new Date(now.getTime() + 14 * 86400000),
          currentPeriodEnd: new Date(now.getTime() + 14 * 86400000),
        },
      },
      users: {
        create: { email, passwordHash, name: 'مالك تجريبي', role: 'OWNER' },
      },
      products: {
        create: [
          { name: 'قميص قطني', description: 'قميص قطني مريح', price: new Prisma.Decimal(25), stock: 40, tags: ['ملابس'] },
          { name: 'حذاء رياضي', description: 'حذاء خفيف للجري', price: new Prisma.Decimal(60), stock: 15, tags: ['أحذية'] },
        ],
      },
      faqs: {
        create: [
          { question: 'ما مدة التوصيل؟', answer: 'من ٢ إلى ٤ أيام عمل.' },
          { question: 'هل الإرجاع متاح؟', answer: 'نعم خلال ٧ أيام مع الفاتورة.' },
        ],
      },
    },
  });
  console.log(`✔ متجر تجريبي: ${merchant.slug} — دخول: ${email} / demo12345`);
}

async function main() {
  await seedPlans();
  if (process.env.SEED_DEMO === 'true') {
    await seedDemo();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

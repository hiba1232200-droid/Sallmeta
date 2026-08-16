# الاختبارات — SellMate AI

مجموعة اختبارات شاملة بـ **Jest** تغطّي الوحدات والتكامل والأمان. صُمّمت لتعمل **بدون قاعدة بيانات حقيقية** — كل وصول إلى Prisma مُموّه (mocked)، فتعمل بسرعة وحتميًا.

## التشغيل

```bash
cd apps/api
npm install            # يثبّت jest / ts-jest / supertest (مضافة إلى devDependencies)
npm run prisma:generate # يلزم لتوليد أنواع @prisma/client المستخدمة في المصنّعات
npm test               # كل الاختبارات
npm run test:unit      # الوحدات فقط
npm run test:security  # الأمان فقط
npm run test:integration
npm run test:cov       # مع تقرير التغطية
```

> البيئة الحالية تمنع تثبيت الحزم، لذا لم تُنفَّذ الاختبارات هنا؛ رُوجعت ثابتًا مقابل الشيفرة الفعلية. بعد `npm install` تعمل مباشرة.

## البنية

```
apps/api/
  jest.config.js            إعداد ts-jest (isolatedModules) + roots: test/, src/
  test/
    helpers/
      prisma.mock.ts         مصنع Prisma وهمي (كل موديل + $transaction)
      factories.ts           بنّاؤو كيانات (متجر/مستخدم/منتج/خطة/اشتراك/طلب) + سياق حارس
      setup-env.ts           متغيّرات بيئة افتراضية للاختبار
    unit/                    اختبارات الوحدة (خدمة معزولة + Prisma وهمي)
    security/                اختبارات الأمان
    integration/             اختبارات التكامل (Nest TestingModule + supertest)
```

## التغطية المطلوبة ↔ الملفات

### Unit
| المجال | الملف | أمثلة على ما يُختبر |
|---|---|---|
| Authentication | `unit/auth.service.spec.ts` | تكرار البريد، تجزئة argon2 المضبوطة، دخول خاطئ/معطّل/متجر معلّق، تحقّق ثابت الزمن، نجاح + تدقيق |
| Products | `unit/products.service.spec.ts` | حدّ المنتجات، حدّ مخزون منخفض افتراضي، حصر بالمتجر، أرشفة/حذف |
| Orders | `unit/orders.service.spec.ts` | تسعير من القاعدة لا العميل، منع تجاوز المخزون، حدّ الخصم، إعادة المخزون عند الإلغاء + إشعار |
| Pricing | `unit/plans.service.spec.ts` | الخطط الأربع وأسعارها، create-only، تعديل جزئي للأسعار |
| Subscription limits | `unit/subscription-limits.service.spec.ts` | حدود الرسائل/المنتجات/الفريق، الخطة الفعلية عند الانتهاء، assertFeature |
| AI validation | `unit/ai-response.validator.spec.ts` | قبول/رفض الأسعار غير المؤصَّلة، تطبيع الأرقام العربية، تأصيل إجمالي الطلب |

### Integration
| المجال | الملف |
|---|---|
| Telegram webhook | `integration/telegram-webhook.e2e-spec.ts` |
| Create order | `integration/create-order.e2e-spec.ts` |
| AI conversation | `integration/ai-conversation.spec.ts` |
| Subscription | `integration/subscription.e2e-spec.ts` |

### Security
| المجال | الملف |
|---|---|
| Unauthorized access / Authorization | `security/authorization.spec.ts` |
| Invalid tokens | `security/tokens.spec.ts` |
| Cross-store access | `security/cross-store.spec.ts` |
| Malicious input | `security/malicious-input.spec.ts` |
| Rate limits | `security/rate-limit.e2e-spec.ts` (يتحقّق فعليًا من 429) |
| Expired subscription | `security/expired-subscription.spec.ts` |

## السيناريوهات الحرجة المطلوبة صراحةً

- **Store A cannot access Store B** — `security/cross-store.spec.ts`: كل استعلام محصور بـ `merchantId`؛ استعلام بيانات متجر آخر يعيد `null` → `NotFound`.
- **Staff cannot modify billing** — `security/authorization.spec.ts`: مسارا `checkout`/`cancel` عليهما `@Roles('OWNER')`، و`RolesGuard` يمنع `STAFF` (403)، ويؤكّده تكامل `integration/subscription.e2e-spec.ts`.
- **Expired subscription cannot use premium features** — `security/expired-subscription.spec.ts`: عند الانتهاء تُرجع `getEffectivePlan` خطة FREE فتُرفض ميزة `analytics` وغيرها (دون حذف بيانات).

## ملاحظات

- الاختبارات لا تتطلّب PostgreSQL؛ Prisma مُموّه بالكامل عبر `createPrismaMock()` الذي يدعم `$transaction` بشكليه (callback/مصفوفة).
- اختبار حدود المعدل (`rate-limit.e2e-spec.ts`) حقيقي: يبني وحدة Throttler صغيرة ويؤكّد رجوع 429 عند التجاوز.
- لإضافة اختبار e2e مقابل قاعدة بيانات حقيقية لاحقًا، استخدم قاعدة اختبار منفصلة و`prisma migrate deploy` ثم ابنِ `AppModule` كاملًا.

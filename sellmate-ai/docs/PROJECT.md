# SellMate AI — دليل المشروع الكامل (Handover)

مساعد مبيعات ذكي على تيليجرام، SaaS متعدّد المتاجر، **جاهز للإنتاج** (ليس نموذجًا تجريبيًا). هذا الملف هو المرجع الشامل: البنية، الإعداد، المتغيّرات، الهجرات، تيليجرام، الذكاء، الدفع، النشر، والاختبارات.

الأرقام: 21 نموذج بيانات · 152 ملف مصدري في الـ API · 20 وحدة · 27 صفحة واجهة (لوحتان) · مجموعة اختبارات (وحدة/تكامل/أمان).

---

## 1) تدقيق الالتزام بقواعد التطوير

روجعت كل قاعدة مقابل الشيفرة الفعلية (تدقيق مستقل) — **كلها ✅**:

| القاعدة | الحالة | الدليل |
|---|---|---|
| لا نموذج وهمي — وظائف حقيقية | ✅ | 20 وحدة عاملة، لا بيانات وهمية في مسار التشغيل |
| لا Mock APIs في الإنتاج | ✅ | `NullProvider`/`NullPaymentProvider` تُخطئ بوضوح ولا تختلق بيانات؛ المزوّدات الحقيقية عند ضبطها |
| لا منتجات ثابتة | ✅ | كل المنتجات من Prisma (`products.service`, أدوات الذكاء تقرأ من القاعدة) |
| لا أسعار ثابتة | ✅ | `orders.service` يحسب السعر من `product.price` ويتجاهل أي سعر من العميل (DTO لا يقبل سعرًا) |
| لا حدود اشتراك ثابتة | ✅ | `usage.service` يفرض عبر `getEffectivePlan` (قراءة من DB)؛ `DEFAULT_PLANS` بذرة create-only فقط |
| لا كشف مفاتيح API | ✅ | كل الأسرار عبر `ConfigService` من البيئة؛ الواجهة تكشف `NEXT_PUBLIC_API_URL` فقط |
| لا أسرار في الواجهة | ✅ | رموز البوت تُشفّر at-rest؛ `getConfig` يعيد `tokenSet:true` فقط |
| مصادقة آمنة | ✅ | argon2id مضبوط + JWT وصول/تحديث بتدوير وإبطال + تحقّق ثابت الزمن |
| لا وصول بين المتاجر | ✅ | كل استعلام محصور بـ `merchantId`؛ حارس RAG يرفض غياب `merchantId` |
| منع اختلاق الذكاء للمنتجات | ✅ | تأصيل بالأدوات + `AiResponseValidator` يرفض أي سعر غير مؤصَّل ويستبدل الرد |
| DB مصدر الحقيقة (منتجات/أسعار/مخزون/طلبات/عملاء) | ✅ | كل ما سبق مأخوذ من Prisma حصريًا |

راجع `docs/SECURITY.md` للتفاصيل الأمنية الكاملة.

---

## 2) بنية المشروع

```
sellmate-ai/
├── apps/
│   ├── api/                      # Backend — NestJS + Prisma + Telegram + AI
│   │   ├── prisma/schema.prisma  # 21 نموذجًا (Merchant, User, Product, Order, ...)
│   │   ├── src/
│   │   │   ├── main.ts, app.module.ts
│   │   │   ├── config/           # env.validation (zod) + configuration
│   │   │   ├── common/           # guards, decorators, filters, crypto, security, uploads
│   │   │   ├── prisma/           # PrismaService (global)
│   │   │   └── modules/          # 20 وحدة:
│   │   │       ├── auth/         # تسجيل/دخول/تحديث/خروج، JWT
│   │   │       ├── users/        # فريق المتجر (OWNER/ADMIN/STAFF)
│   │   │       ├── merchants/    # المتجر + إعدادات الذكاء
│   │   │       ├── products/     # CRUD منتجات (المصدر الوحيد للأسعار)
│   │   │       ├── inventory/    # حركات المخزون
│   │   │       ├── orders/       # الطلبات (تسعير من DB، خصم، حالات)
│   │   │       ├── customers/    # العملاء
│   │   │       ├── conversations/# المحادثات + التحويل البشري
│   │   │       ├── faqs, knowledge/ # قاعدة المعرفة + RAG (retrieval.service)
│   │   │       ├── ai/           # الوكيل البيعي + الأدوات + المدقّق + المزوّدات
│   │   │       ├── telegram/     # الويبهوك + الموزّع (dispatcher)
│   │   │       ├── subscriptions/# الخطط، الاستخدام، الحدود
│   │   │       ├── payments/     # Stripe/None
│   │   │       ├── platform-admin/# لوحة المشرف (عابرة للمتاجر)
│   │   │       ├── notifications/# إشعارات تيليجرام (مالك/عميل)
│   │   │       ├── analytics/    # محرّك التحليلات
│   │   │       ├── audit/        # سجلّ التدقيق
│   │   │       ├── public-api/   # REST عامة موثّقة (/api/...) + OpenAPI/Swagger
│   │   │       └── health/       # /health
│   │   ├── test/                 # unit / integration / security
│   │   ├── Dockerfile, docker-entrypoint.sh, railway.json
│   │   └── package.json
│   ├── dashboard/                # Frontend — لوحة التاجر (Next.js, RTL)
│   │   ├── src/app/(dashboard)/  # 14 صفحة (منتجات/طلبات/محادثات/تحليلات/اشتراك/إشعارات...)
│   │   ├── Dockerfile, railway.json
│   └── admin/                    # لوحة المشرف الأعلى (Next.js) — 11 صفحة
│       ├── Dockerfile, railway.json
├── docs/                         # API.md, REST_API.md, SECURITY.md, TESTING.md, SETUP.md, ARCHITECTURE.md, PROJECT.md
├── docker-compose.yml            # إنتاج (postgres + api + dashboard + admin)
├── docker-compose.dev.yml        # بنية تطوير (postgres + redis)
├── .env.example
└── README.md                     # دليل النشر على Railway (8 خطوات)
```

---

## 3) الإعداد المحلي

المتطلّبات: Node 20+، Docker (لـ Postgres)، npm.

```bash
# 1) البنية التحتية (Postgres + Redis)
docker compose -f docker-compose.dev.yml up -d

# 2) تثبيت الحزم (workspaces)
npm install

# 3) البيئة
cp .env.example .env        # اضبط JWT_SECRET وغيره

# 4) قاعدة البيانات
npm run prisma:generate
npm run prisma:migrate      # ينشئ الجداول
npm run db:seed             # خطط الاشتراك (بيانات تشغيلية)
# للتجربة: SEED_DEMO=true npm run db:seed  → متجر تجريبي (owner@demo.local / demo12345)

# 5) التشغيل
npm run dev:api             # http://localhost:4000  (الصحّة /health)
npm run dev:dashboard       # http://localhost:3000
npm run dev:admin           # http://localhost:3001
```

بديل «كل شيء بالحاويات»: `cp .env.example .env` ثم `docker compose up -d --build`.

---

## 4) متغيّرات البيئة

القائمة الكاملة في `.env.example`. الأساسية:

| المتغيّر | الوصف |
|---|---|
| `NODE_ENV` | `production` يفرض أسرارًا قوية إلزامية |
| `PORT` / `API_PORT` | المنفذ (Railway يضبط `PORT` تلقائيًا) |
| `DATABASE_URL` | اتصال PostgreSQL |
| `JWT_SECRET` | 32+ حرفًا (`openssl rand -base64 48`) — يُشتقّ منه سرّ التحديث |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | أعمار الرموز (ثوانٍ) |
| `ENCRYPTION_KEY` | base64 لـ 32 بايت — **إلزامي في الإنتاج** (تشفير رموز البوتات) |
| `TELEGRAM_WEBHOOK_SECRET` | 16+ حرفًا (تحقّق الويبهوك) |
| `TELEGRAM_BOT_TOKEN` | بوت منصّة اختياري (كل تاجر يربط بوته من اللوحة) |
| `APP_URL` / `WEBHOOK_URL` / `CORS_ORIGINS` | العناوين العامة |
| `AI_PROVIDER` + `AI_API_KEY` | `openai`\|`anthropic`\|`gemini`\|`none` + المفتاح |
| `PAYMENT_PROVIDER` + `STRIPE_*` | `stripe`\|`none` + الاعتماد |
| `PLATFORM_ADMIN_EMAILS` | بريد مشرفي المنصّة (تعديل الخطط) |
| `NEXT_PUBLIC_API_URL` | عنوان الـ API (يُدمَج في الواجهة وقت البناء) |

> لا يوجد أي سرّ داخل الشيفرة؛ كلها من البيئة عبر `ConfigService` (تحقّق zod عند الإقلاع).

---

## 5) هجرات قاعدة البيانات

```bash
cd apps/api
npm run prisma:generate            # توليد العميل
npm run prisma:migrate -- --name init   # إنشاء هجرة (تطوير)
npm run prisma:deploy              # تطبيق الهجرات (إنتاج)
npm run prisma:studio              # تصفّح البيانات
npm run db:seed                    # خطط الاشتراك
```

في الحاويات/Railway: `docker-entrypoint.sh` يطبّق `prisma migrate deploy` تلقائيًا عند الإقلاع (أو `db push` عند أوّل نشر بلا هجرات). النماذج الرئيسية وعلاقاتها: `Merchant 1—* User/Product/Order/Customer/Conversation`, `Order *—* Product عبر OrderItem`, `Merchant 1—1 Subscription —* Plan`, بالإضافة إلى `Notification/AuditLog/Payment/ErrorLog`.

---

## 6) إعداد تيليجرام

1. أنشئ بوتًا عبر **@BotFather** واحصل على **Token**.
2. من لوحة التاجر → الإعدادات → الصق الـ Token → يُشفّر at-rest ويُسجَّل الويبهوك تلقائيًا على
   `${WEBHOOK_URL}/api/v1/telegram/webhook/<merchantId>` بسرّ فريد لكل متجر.
3. التحقّق ثابت الزمن للسرّ (`timingSafeEqual`)؛ المتاجر المعلّقة يتوقّف بوتها. يتطلّب **HTTPS**.

بديل عام موثّق: `POST /api/webhooks/telegram?merchantId=<id>` (راجع `docs/REST_API.md`).

---

## 7) إعداد الذكاء الاصطناعي

طبقة مزوّد قابلة للتبديل — لا ربط بمزوّد واحد:

```bash
AI_PROVIDER=openai     # أو anthropic أو gemini
AI_API_KEY=sk-...      # مفتاح المزوّد
# اختياري: AI_MODEL, AI_TEMPERATURE, AI_MAX_TOKENS, OPENAI_MODEL/ANTHROPIC_MODEL/GEMINI_MODEL
```

- **التأصيل**: الوكيل (`sales-agent.service`) يستدعي أدوات تقرأ من قاعدة المتجر فقط (منتجات/معرفة/طلبات).
- **منع الاختلاق**: `AiResponseValidator` يرفض أي سعر لا يطابق أسعار المتجر/إجمالي طلب، ويستبدل الرد برسالة آمنة.
- `AI_PROVIDER=none` → المساعد يعتذر بلطف بدل اختلاق أي معلومة.

---

## 8) إعداد الدفع

```bash
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

- `POST /api/subscription/checkout` ينشئ جلسة دفع؛ الويبهوك يفعّل الخطة ويسجّل الدفعة.
- `PAYMENT_PROVIDER=none` → الترقية اليدوية عبر `POST /subscriptions/change`.
- الأسعار والحدود كلها من جدول `Plan` (قابلة للتعديل من لوحة المشرف)، لا ثوابت.

---

## 9) النشر (Railway / Docker)

الدليل التفصيلي بالخطوات الثماني في **`README.md`**: إنشاء قاعدة، متغيّرات البيئة، الهجرات، ويبهوك تيليجرام، تشغيل Backend، تشغيل Frontend، ربط النطاق، وHTTPS.

باختصار على Railway: مشروع واحد فيه **Postgres** + خدمة **api** (Root Directory=`apps/api`) + خدمة **dashboard** (Root=`apps/dashboard`, ومتغيّر بناء `NEXT_PUBLIC_API_URL`) + **admin** اختيارية. كل خدمة تُبنى من `Dockerfile`/`railway.json`؛ فحص الصحّة على `/health`؛ وHTTPS تلقائي.

خادم واحد بالحاويات: `docker compose up -d --build`.

---

## 10) الاختبارات

```bash
cd apps/api
npm install
npm run prisma:generate
npm test                 # الكل (بلا قاعدة بيانات — Prisma مُموّه)
npm run test:unit | test:security | test:integration
npm run test:cov         # تغطية
```

التغطية: المصادقة، المنتجات، الطلبات، التسعير، حدود الاشتراك، تحقّق الذكاء، ويبهوك تيليجرام، إنشاء الطلب، محادثة الذكاء، الاشتراك، والأمان (وصول غير مصرّح، عزل المتاجر، رموز غير صالحة، حدود المعدل، إدخال خبيث، اشتراك منتهٍ). راجع `docs/TESTING.md`.

---

## مراجع سريعة

- REST العامة + Swagger: `GET /api/docs` · المواصفة `GET /api/openapi.json` · `docs/REST_API.md`
- كل نقاط الـ API الداخلية: `docs/API.md`
- الأمان: `docs/SECURITY.md` · الاختبارات: `docs/TESTING.md` · البنية: `docs/ARCHITECTURE.md`

<div dir="rtl">

# دليل الإعداد والتشغيل — SellMate AI

## المتطلبات

- **Node.js 20+** و **npm 10+**
- **Docker** و **Docker Compose** (لـ PostgreSQL و Redis)، أو PostgreSQL مثبّت محليًا
- وصول إلى مستودع npm لتثبيت الحزم
- (اختياري) حساب على OpenAI أو Anthropic لتفعيل الذكاء الاصطناعي
- (اختياري) بوت Telegram من [@BotFather](https://t.me/BotFather)

---

## 1) تثبيت الحزم

من جذر المشروع:

```bash
npm install
```

يثبّت هذا حزم المشروعين (`api` و`dashboard`) عبر npm workspaces.

---

## 2) متغيّرات البيئة

انسخ القالب وعدّله:

```bash
cp .env.example .env
```

ولّد أسرارًا قوية:

```bash
openssl rand -base64 48   # لـ JWT_SECRET
openssl rand -base64 32   # لـ ENCRYPTION_KEY (إن أردت تشفير أسرار البوتات)
```

أهم المتغيّرات:

| المتغيّر | الوصف |
|---|---|
| `DATABASE_URL` | رابط PostgreSQL |
| `JWT_SECRET` | سرّ توقيع الرموز (إلزامي؛ يُشتقّ منه سرّ التحديث) |
| `APP_URL` | عنوان لوحة التحكم (للـ CORS والروابط) |
| `WEBHOOK_URL` | العنوان العام للـ API (لتسجيل webhook تيليجرام) |
| `TELEGRAM_BOT_TOKEN` | بوت افتراضي/منصّة اختياري (كل متجر يربط بوته من اللوحة) |
| `AI_PROVIDER` | `openai` أو `anthropic` أو `gemini` أو `none` |
| `AI_API_KEY` | مفتاح المزوّد المختار (عام)، أو استخدم مفتاح المزوّد الخاص |
| `PAYMENT_PROVIDER` | `stripe` أو `none` + بيانات الاعتماد (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) |
| `PLATFORM_ADMIN_EMAILS` | بريد مشرفي المنصّة (مفصول بفواصل) — يملكون تعديل أسعار/حدود الخطط |
| `ENCRYPTION_KEY` | تشفير رموز البوتات at-rest (اختياري بالتطوير) |

> لوحة التحكم تقرأ `NEXT_PUBLIC_API_URL`. أنشئ `apps/dashboard/.env.local` من `apps/dashboard/.env.example` إن غيّرت المنفذ.

---

## 3) قاعدة البيانات

شغّل PostgreSQL و Redis:

```bash
docker compose up -d
```

جهّز المخطط:

```bash
npm run prisma:generate   # توليد Prisma Client
npm run prisma:migrate    # إنشاء الجداول (development migration)
npm run db:seed           # تجهيز خطط الاشتراك
```

- `npm run db:seed` ينشئ **خطط الاشتراك** فقط (بيانات تشغيلية حقيقية).
- لإنشاء **متجر تجريبي محلي** للاختبار: `SEED_DEMO=true npm run db:seed` (الدخول: `owner@demo.local` / `demo12345`). هذا للتطوير فقط.

للإنتاج استخدم `npm run prisma:deploy` بدل `prisma:migrate`.

أدوات مفيدة: `npm run prisma:studio` لتصفّح البيانات.

---

## 4) التشغيل

```bash
npm run dev:api         # الـ API على http://localhost:4000
npm run dev:dashboard   # لوحة التاجر على http://localhost:3000
npm run dev:admin       # لوحة المشرف الأعلى على http://localhost:3001
```

> **لوحة المشرف الأعلى** (`apps/admin`) تطبيق منفصل على المنفذ 3001. تُقرأ `NEXT_PUBLIC_API_URL` من `apps/admin/.env.local`. الدخول مقصور على الحسابات التي بريدها ضمن `PLATFORM_ADMIN_EMAILS`؛ أي حساب آخر يُرفض. منها يُدار: المستخدمون، المتاجر (تعليق/تفعيل)، الاشتراكات، الخطط والحدود، المدفوعات، الطلبات، استخدام الذكاء، التقارير، سجلّ النظام، والأخطاء.

تحقّق من الصحّة: `GET http://localhost:4000/api/v1/health`.

أنشئ حسابك الأول من صفحة اللوحة (تبويب «متجر جديد»)، أو عبر:

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"storeName":"متجري","name":"اسمي","email":"me@example.com","password":"password123"}'
```

---

## 5) تفعيل الذكاء الاصطناعي

اختر المزوّد بمتغيّر واحد `AI_PROVIDER`، وضع المفتاح في `AI_API_KEY` (عام):

```env
# OpenAI
AI_PROVIDER=openai
AI_API_KEY=sk-...

# أو Anthropic
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...

# أو Google Gemini
AI_PROVIDER=gemini
AI_API_KEY=AIza...
```

- لتجاوز اسم الموديل: `AI_MODEL=...` (أو `OPENAI_MODEL` / `ANTHROPIC_MODEL` / `GEMINI_MODEL`).
- يمكن استخدام مفتاح خاص (`OPENAI_API_KEY` مثلًا) بدل `AI_API_KEY` عند الحاجة.

أعد تشغيل الـ API. جرّب المساعد من لوحة التحكم: **الإعدادات ← إعدادات المساعد ← جرّب المساعد** (يستدعي `POST /ai/preview`).

> بوضع `none` يردّ المساعد برسالة تعذّر آمنة دون اختراع معلومات.

---

## 6) ربط بوت Telegram

الـ webhook يتطلب أن يكون الـ API متاحًا على عنوان عام عبر HTTPS. في التطوير استخدم نفقًا:

```bash
# مثال باستخدام ngrok
ngrok http 4000
# ثم اضبط في .env:
# PUBLIC_API_URL=https://<subdomain>.ngrok-free.app
```

بعدها:

1. أنشئ بوتًا عبر [@BotFather](https://t.me/BotFather) واحصل على الرمز.
2. من اللوحة: **الإعدادات ← بوت تيليجرام** ← الصق الرمز ← **ربط البوت**.
   - يتحقّق النظام من الرمز، يخزّنه مشفّرًا، ويضبط webhook تلقائيًا على:
     `PUBLIC_API_URL/api/v1/telegram/webhook/{merchantId}` بسرّ تحقّق خاص.
3. (اختياري) أدخل «معرّف محادثة المالك» لاستقبال إشعارات الطلبات على Telegram.
4. راسل البوت بـ `/start` ثم جرّب الأسئلة والطلبات.

---

## 6.5) الدفع (اختياري)

طبقة الدفع قابلة للتبديل عبر `PAYMENT_PROVIDER` (لا ربط hard-coded):

```env
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

- إنشاء جلسة اشتراك: `POST /api/v1/payments/checkout` بجسم `{ "tier": "PRO" }` (يرجع رابط الدفع). من اللوحة: **الإعدادات ← الاشتراك ← اختيار خطة**.
- استقبال الأحداث: `POST /api/v1/payments/webhook` (يتحقّق من التوقيع ويُفعّل الخطة تلقائيًا). اضبط الـ endpoint في Stripe على هذا العنوان.
- بوضع `none` تبقى إدارة الخطط يدوية عبر `POST /subscriptions/change`.

---

## 7) ملاحظات الإنتاج

- استخدم أسرارًا قوية واضبط `ENCRYPTION_KEY`.
- `NODE_ENV=production` و`npm run build` ثم `npm run start:prod -w @sellmate/api`.
- شغّل `npm run prisma:deploy` لتطبيق الـ migrations.
- ضع الـ API خلف HTTPS (reverse proxy) واضبط `CORS_ORIGINS` على نطاق اللوحة.
- فعّل نسخًا احتياطيًا لقاعدة البيانات، ومراقبة عبر `/health`.

</div>

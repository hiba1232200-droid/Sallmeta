# SellMate AI

مساعد مبيعات ذكي على تيليجرام (SaaS متعدّد المتاجر). يجيب على العملاء، يرشّح المنتجات، وينشئ الطلبات 24/7 — بالاعتماد على كتالوج المتجر وأسعاره الحقيقية فقط.

المكوّنات:

- **Backend** — NestJS + Prisma + PostgreSQL، واجهة REST موثّقة، محرّك ذكاء، وبوت تيليجرام. (`apps/api`)
- **Frontend** — لوحة التاجر (Next.js، عربي RTL). (`apps/dashboard`)
- **لوحة المشرف** — لوحة مشرف المنصّة المنفصلة. (`apps/admin`)
- **PostgreSQL** — قاعدة البيانات.

الوثائق: `docs/API.md` (REST) · `docs/SECURITY.md` (الأمان) · `docs/TESTING.md` (الاختبارات) · `docs/SETUP.md` (التطوير المحلي).

---

## فحص الصحّة

```
GET /health        →  { "status": "ok" }        (liveness — يستخدمه Railway)
GET /health/ready  →  { "status": "ok", "db": true, ... }   (readiness — يفحص القاعدة)
```

المسار `/health` مستثنى من البادئة `/api` والنسخنة، فيُخدَم على الجذر مباشرة.

---

## تشغيل محلي كامل (Docker Compose)

يشغّل PostgreSQL + Backend + Frontend + لوحة المشرف على خادمك:

```bash
cp .env.example .env          # اضبط الأسرار (JWT_SECRET, ENCRYPTION_KEY, ...)
docker compose up -d --build
```

- اللوحة: http://localhost:3000 · لوحة المشرف: http://localhost:3001 · الـ API: http://localhost:4000 · الصحّة: http://localhost:4000/health

الهجرات تُطبّق تلقائيًا عند إقلاع خدمة الـ API (`docker-entrypoint.sh`).

> للتطوير (تشغيل التطبيقات عبر npm مع بنية تحتية فقط): `docker compose -f docker-compose.dev.yml up -d` ثم راجع `docs/SETUP.md`.

---

# النشر على Railway — خطوة بخطوة

سننشر ثلاث خدمات في مشروع Railway واحد: **Postgres** (قاعدة) + **api** (Backend) + **dashboard** (Frontend). لوحة المشرف (admin) اختيارية بنفس طريقة dashboard.

المتطلّبات: حساب Railway، ومستودع Git يحتوي هذا المشروع (ادفعه إلى GitHub).

## 1) إنشاء Database

1. أنشئ مشروعًا جديدًا في Railway: **New Project**.
2. داخل المشروع: **+ New → Database → Add PostgreSQL**.
3. Railway ينشئ قاعدة PostgreSQL ويولّد متغيّر الاتصال `DATABASE_URL` تلقائيًا (تجده في خدمة Postgres → Variables). سنشير إليه من خدمة الـ Backend بدل نسخه يدويًا.

> لا حاجة لإنشاء الجداول يدويًا — تُنشأ تلقائيًا في الخطوة 3 (الهجرات).

## 2) إضافة Environment Variables

أنشئ خدمة الـ Backend أولًا:

1. **+ New → GitHub Repo** → اختر المستودع.
2. في إعدادات الخدمة → **Settings → Root Directory** = `apps/api`. (يجعل Railway يبني عبر `apps/api/Dockerfile` و`railway.json`.)
3. افتح تبويب **Variables** للخدمة وأضِف:

| المتغيّر | القيمة |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (مرجع لخدمة Postgres) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | سرّ قوي 32+ حرفًا — `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | base64 لـ 32 بايت — `openssl rand -base64 32` |
| `TELEGRAM_WEBHOOK_SECRET` | سرّ 16+ حرفًا — `openssl rand -base64 24` |
| `APP_URL` | عنوان اللوحة العام (نضبطه بعد الخطوة 6/7) |
| `WEBHOOK_URL` | عنوان الـ API العام (دومين Railway للـ backend) |
| `PLATFORM_ADMIN_EMAILS` | بريدك (لإدارة الخطط من لوحة المشرف) |
| `AI_PROVIDER` + `AI_API_KEY` | `openai`/`anthropic`/`gemini` ومفتاحه (أو `none` مؤقتًا) |
| `PAYMENT_PROVIDER` | `stripe` + `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (أو `none`) |

> `PORT` تضبطه Railway تلقائيًا ويستمع عليه الخادم — لا تضفه يدويًا. في الإنتاج يرفض الخادم الإقلاع بأسرار ضعيفة أو ناقصة (JWT/ENCRYPTION/WEBHOOK).

## 3) تشغيل Prisma migrations

الهجرات تُطبَّق **تلقائيًا** عند كل إقلاع عبر `docker-entrypoint.sh`:

- إن كانت هناك ملفات هجرات في `apps/api/prisma/migrations` → `prisma migrate deploy`.
- إن لم توجد (أوّل نشر) → `prisma db push` لإنشاء الجداول من المخطط.

للحصول على **تاريخ هجرات نظيف** (مستحسن للإنتاج)، أنشئ الهجرة الأولى محليًا وادفعها قبل النشر:

```bash
cd apps/api
# على قاعدة محلية/تجريبية:
npx prisma migrate dev --name init
git add prisma/migrations && git commit -m "init migration" && git push
```

تشغيل هجرة يدويًا على Railway عند الحاجة:

```bash
railway run --service api npx prisma migrate deploy
```

بعد أوّل تشغيل ناجح، جهّز خطط الاشتراك:

```bash
railway run --service api npm run db:seed
```

## 4) إنشاء Telegram webhook

كل تاجر يربط بوته من اللوحة، والنظام يسجّل الويبهوك تلقائيًا. الربط:

1. أنشئ بوتًا عبر **@BotFather** في تيليجرام واحصل على **Token**.
2. من لوحة التاجر → إعدادات البوت → الصق الـ Token → يسجّل النظام الويبهوك تلقائيًا على:
   `${WEBHOOK_URL}/api/v1/telegram/webhook/<merchantId>` مع سرّ تحقّق فريد.

تسجيل يدوي (اختياري) عبر واجهة تيليجرام:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<api-domain>/api/webhooks/telegram?merchantId=<merchantId>" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

> شرط تيليجرام: الويبهوك يجب أن يكون على **HTTPS** — وهو مُتوفّر تلقائيًا على Railway (الخطوة 8).

## 5) تشغيل Backend

1. بعد ضبط المتغيّرات، ينشر Railway الخدمة تلقائيًا من الـ Dockerfile.
2. في **Settings → Networking → Generate Domain** لتوليد دومين عام للـ API (مثل `sellmate-api.up.railway.app`).
3. اضبط `WEBHOOK_URL` على هذا الدومين (`https://sellmate-api.up.railway.app`).
4. تحقّق من الصحّة: افتح `https://<api-domain>/health` — يجب أن يعيد `{"status":"ok"}`. (Railway يستخدمه كـ healthcheck تلقائيًا عبر `railway.json`.)

## 6) تشغيل Frontend

1. **+ New → GitHub Repo** (نفس المستودع) → خدمة جديدة.
2. **Settings → Root Directory** = `apps/dashboard`.
3. **Variables**: أضِف متغيّر البناء `NEXT_PUBLIC_API_URL` = دومين الـ API (مثل `https://sellmate-api.up.railway.app`).
   - مهم: هذا المتغيّر يُدمَج في حزمة العميل وقت **البناء**؛ أي تغيير له يتطلّب إعادة نشر.
4. انشر، ثم **Generate Domain** للّوحة.
5. عُد إلى خدمة الـ api واضبط `APP_URL` على دومين اللوحة (لضبط CORS والروابط)، ثم أعِد نشر الـ api.
6. (اختياري) كرّر لخدمة **admin** بـ Root Directory = `apps/admin`.

## 7) ربط Domain

لاستخدام نطاقك الخاص بدل دومين Railway:

1. خدمة الـ api أو dashboard → **Settings → Networking → Custom Domain → Add**.
2. أدخل نطاقك (مثل `app.yourdomain.com` للّوحة و`api.yourdomain.com` للـ API).
3. Railway يعرض سجلّ **CNAME** — أضِفه في إدارة DNS لنطاقك (لدى مزوّد النطاق).
4. انتظر انتشار الـ DNS (دقائق إلى ساعات).
5. حدّث المتغيّرات بعد الربط: `APP_URL`, `WEBHOOK_URL`, و`NEXT_PUBLIC_API_URL` لتشير إلى نطاقاتك، ثم أعِد النشر.

## 8) تشغيل HTTPS

- Railway يوفّر **HTTPS تلقائيًا** لكل دومين (Railway أو مخصّص) عبر شهادات تُصدَر وتُجدَّد آليًا — لا إعداد يدوي.
- تأكّد أن كل العناوين تبدأ بـ `https://`. في الإنتاج يُفعَّل **HSTS** تلقائيًا من الخادم، وويبهوك تيليجرام يعمل فقط عبر HTTPS.
- الخادم مضبوط خلف وكيل عكسي (`trust proxy`) للحصول على IP الحقيقي (للتدقيق وحدود المعدل).

---

## ملخّص المتغيّرات الحرجة

راجع `.env.example` للقائمة الكاملة. الأساسية للإنتاج: `DATABASE_URL`، `JWT_SECRET`، `ENCRYPTION_KEY`، `TELEGRAM_WEBHOOK_SECRET`، `APP_URL`، `WEBHOOK_URL`، `NEXT_PUBLIC_API_URL`، و`PLATFORM_ADMIN_EMAILS`.

## اختبارات

```bash
cd apps/api && npm install && npm test
```

راجع `docs/TESTING.md`.

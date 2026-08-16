# نشر SellMate AI على Railway — دليل عملي مبسّط

اتبع الخطوات بالترتيب. الوقت المتوقّع: 15–20 دقيقة.

---

## قبل ما تبدأ (شغلتين)

1. **ارفع المشروع على GitHub**: فكّ ضغط `sellmate-ai.zip`، ثم:
   ```bash
   cd sellmate-ai
   git init && git add . && git commit -m "SellMate AI"
   # أنشئ مستودعًا فارغًا على github.com، ثم:
   git remote add origin https://github.com/USERNAME/sellmate-ai.git
   git push -u origin main
   ```
2. **افتح حساب على [railway.app](https://railway.app)** (تسجيل بحساب GitHub أسهل).

---

## الخطوة 1 — أنشئ المشروع + قاعدة البيانات

1. في Railway اضغط **New Project**.
2. داخل المشروع: **+ New → Database → Add PostgreSQL**.
   ✅ صار عندك قاعدة، و Railway يولّد `DATABASE_URL` تلقائيًا.

---

## الخطوة 2 — أنشئ خدمة الـ Backend (api)

1. **+ New → GitHub Repo** → اختر مستودع `sellmate-ai`.
2. افتح الخدمة → **Settings → Root Directory** = اكتب: `apps/api`
   (هيك Railway يبني من `apps/api/Dockerfile` تلقائيًا.)
3. افتح تبويب **Variables** للخدمة، واضغط **Raw Editor**، والصق هذا كامل:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
JWT_SECRET=qNUf+wJQT9fQz8mMXL+bp1SF11mE0sjFCReQq2yrXCi1FfG0NH2828ESmRLXNQap
ENCRYPTION_KEY=Yduzb/flCTPqbu3rrgWJ1PbXY6mgj1RH8SO9Kq8rtEQ=
TELEGRAM_WEBHOOK_SECRET=1gynFQw+VULE6jfGKOobeZtX7fOjWcz4
PLATFORM_ADMIN_EMAILS=ضع-بريدك@example.com
AI_PROVIDER=none
PAYMENT_PROVIDER=none
APP_URL=https://TEMP
WEBHOOK_URL=https://TEMP
```

> الأسرار أعلاه **مولّدة قويّة وجاهزة** — تقدر تستخدمها كما هي. `DATABASE_URL` اتركه هيك بالضبط (مرجع للقاعدة). عدّل `PLATFORM_ADMIN_EMAILS` لبريدك.

4. اضغط **Deploy**. انتظر حتى يصير أخضر (Success).
5. **Settings → Networking → Generate Domain** → بينتج رابط مثل
   `https://sellmate-api-production.up.railway.app`. **انسخه.**
6. ارجع لتبويب **Variables** وعدّل هذين السطرين ليصيرا نفس الرابط، ثم أعد النشر:
   ```
   APP_URL=https://sellmate-api-production.up.railway.app
   WEBHOOK_URL=https://sellmate-api-production.up.railway.app
   ```
   (لاحقًا لو ربطت لوحة تاجر منفصلة، خلي `APP_URL` رابط اللوحة.)
7. **تحقّق**: افتح `https://<رابط-الـapi>/health` — لازم يطلع `{"status":"ok"}`. 🎉
   (الهجرات تُطبَّق تلقائيًا عند الإقلاع — ما في شي تعمله يدويًا.)

---

## الخطوة 3 — أنشئ خدمة الواجهة (dashboard)

1. **+ New → GitHub Repo** → نفس المستودع → خدمة جديدة.
2. **Settings → Root Directory** = `apps/dashboard`
3. **Variables** → أضِف:
   ```
   NEXT_PUBLIC_API_URL=https://<رابط-الـapi>
   ```
   (نفس رابط الـ api من الخطوة 2. مهم: هذا يُدمَج وقت البناء.)
4. **Deploy**، ثم **Generate Domain** للّوحة → بينتج رابط لوحتك.
5. (اختياري) كرّر نفس الشي لخدمة **admin** مع Root Directory = `apps/admin`.

---

## الخطوة 4 — جهّز خطط الاشتراك (مرّة واحدة)

من صفحة خدمة الـ api في Railway، تبويب **Deployments** أو عبر أداة Railway CLI:
```
railway run --service api npm run db:seed
```
(أو تجاهلها الآن؛ الخطط تُنشأ تلقائيًا أول ما يفتح تاجر صفحة الاشتراك.)

---

## الخطوة 5 — اربط بوت تيليجرام

1. افتح تيليجرام → **@BotFather** → `/newbot` → خذ الـ **Token**.
2. افتح لوحة التاجر (رابطها من الخطوة 3) → سجّل حساب/ادخل → **الإعدادات** → الصق الـ Token.
   ✅ النظام يسجّل الويبهوك تلقائيًا (على HTTPS — متوفّر مجانًا من Railway).
3. جرّب: راسل بوتك على تيليجرام — لازم يرد.

---

## (اختياري) لتفعيل الذكاء والدفع لاحقًا

- **الذكاء**: في Variables لخدمة الـ api غيّر:
  ```
  AI_PROVIDER=openai        (أو anthropic أو gemini)
  AI_API_KEY=sk-...         (مفتاحك)
  ```
  ثم أعد النشر. (بدونها، المساعد يعتذر بأدب بدل اختلاق معلومات.)
- **الدفع**: `PAYMENT_PROVIDER=stripe` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`.

---

## نطاق مخصّص + HTTPS

- HTTPS **تلقائي** على Railway لكل رابط — ما في إعداد.
- لنطاقك الخاص: خدمة → **Settings → Networking → Custom Domain** → أضِف نطاقك، وضِف سجلّ **CNAME** يعطيك إياه Railway في إعدادات DNS عند مزوّد نطاقك. بعد الربط، حدّث `APP_URL`/`WEBHOOK_URL`/`NEXT_PUBLIC_API_URL` لنطاقك وأعد النشر.

---

## ملخّص «شو بدي أضيف» (نسخ سريع)

| الخدمة | Root Directory | المتغيّرات الأساسية |
|---|---|---|
| Postgres | — | (تلقائي) |
| api | `apps/api` | `DATABASE_URL`, `NODE_ENV`, `JWT_SECRET`, `ENCRYPTION_KEY`, `TELEGRAM_WEBHOOK_SECRET`, `PLATFORM_ADMIN_EMAILS`, `APP_URL`, `WEBHOOK_URL`, `AI_PROVIDER`, `PAYMENT_PROVIDER` |
| dashboard | `apps/dashboard` | `NEXT_PUBLIC_API_URL` |
| admin (اختياري) | `apps/admin` | `NEXT_PUBLIC_API_URL` |

**علامة النجاح النهائية:** `/health` يرجّع `{"status":"ok"}` + بوتك يرد على تيليجرام.

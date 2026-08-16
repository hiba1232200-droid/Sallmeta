# SellMate AI — REST API الموثّقة

واجهة REST عامة على مسارات `/api/...` (بلا نسخة)، موثّقة بمواصفة **OpenAPI 3.0** ومعروضة تفاعليًا عبر **Swagger UI**.

- التوثيق التفاعلي: `GET /api/docs` (Swagger UI — جرّب الطلبات مباشرة)
- المواصفة الخام: `GET /api/openapi.json`

> الواجهة الداخلية `/api/v1/...` تبقى كما هي وتستخدمها لوحتا التاجر والمشرف. مسارات `/api/...` هي الواجهة العامة الموثّقة، وتفوّض إلى نفس المنطق.

## المصادقة

JWT عبر ترويسة `Authorization: Bearer <accessToken>`. الرمز يُصدَر من `/api/auth/login` أو `/api/auth/register`، وصلاحيته قصيرة (افتراضيًا 15 دقيقة)، ويُجدَّد عبر رمز التحديث.

```bash
# تسجيل الدخول
curl -X POST https://api.example.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"Passw0rd"}'

# استخدام الرمز
curl https://api.example.com/api/products \
  -H 'Authorization: Bearer <accessToken>'
```

## المسارات

| المجال | الطريقة | المسار | الوصول |
|---|---|---|---|
| Authentication | POST | `/api/auth/register` | عام |
| | POST | `/api/auth/login` | عام |
| | POST | `/api/auth/logout` | عام |
| Products | GET | `/api/products` | مصادَق |
| | POST | `/api/products` | OWNER/ADMIN/STAFF |
| | PUT | `/api/products/:id` | OWNER/ADMIN/STAFF |
| | DELETE | `/api/products/:id` | OWNER/ADMIN/STAFF |
| Orders | GET | `/api/orders` | مصادَق |
| | GET | `/api/orders/:id` | مصادَق |
| | POST | `/api/orders` | OWNER/ADMIN/STAFF |
| | PUT | `/api/orders/:id` | OWNER/ADMIN/STAFF (تحديث الحالة) |
| Customers | GET | `/api/customers` | مصادَق |
| | GET | `/api/customers/:id` | مصادَق |
| Conversations | GET | `/api/conversations` | مصادَق |
| | GET | `/api/conversations/:id` | مصادَق |
| Analytics | GET | `/api/analytics` | مصادَق |
| Subscription | GET | `/api/subscription` | مصادَق |
| | POST | `/api/subscription/checkout` | OWNER |
| | POST | `/api/subscription/cancel` | OWNER |
| Webhooks | POST | `/api/webhooks/telegram?merchantId=…` | عام (سرّ في الترويسة) |

## العزل والصلاحيات

كل الطلبات محصورة تلقائيًا بنطاق متجر المستخدم (`merchantId` من الرمز) — لا يمكن لمتجر رؤية بيانات متجر آخر. الأدوار: `OWNER` (كل شيء)، `ADMIN` (كل شيء عدا حذف المتجر)، `STAFF` (المنتجات/الطلبات/العملاء/المحادثات).

## صيغة الأخطاء

استجابة موحّدة، دون تسريب تفاصيل داخلية أو stack traces:

```json
{
  "statusCode": 400,
  "error": "ValidationError",
  "message": ["السعر مطلوب"],
  "timestamp": "2026-08-14T10:00:00.000Z",
  "path": "/api/products",
  "requestId": "يظهر لأخطاء الخادم 5xx فقط"
}
```

## حدود المعدل

افتراضيًا 120 طلب/دقيقة لكل عميل، مع حدود أشدّ على المصادقة (تسجيل 5/دقيقة، دخول 10/دقيقة). ويبهوك تيليجرام مُعفى.

## ملاحظة حول ويبهوك تيليجرام

`POST /api/webhooks/telegram` بديل عام لاستقبال التحديثات؛ مرّر `?merchantId=<id>` والسرّ عبر ترويسة `x-telegram-bot-api-secret-token`. (النظام يسجّل تلقائيًا ويبهوك كل متجر عند ربط البوت.)

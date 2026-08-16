<div dir="rtl">

# مرجع الـ API — SellMate AI

- **القاعدة**: `http://localhost:4000/api/v1`
- **المصادقة**: أرسل `Authorization: Bearer <accessToken>` لكل المسارات ما لم تُعلَّم بأنها عامة.
- **الأدوار**: `OWNER` (كل شيء) · `ADMIN` (كل شيء عدا الفوترة وحذف المتجر) · `STAFF` (المنتجات/الطلبات/العملاء/المحادثات فقط).
- **التصفّح** (القوائم): معاملات `page` (افتراضي 1)، `limit` (افتراضي 20، أقصى 100)، `search`، `sortBy`، `sortOrder` (`asc`/`desc`). تُعيد `{ items, meta }`.
- **الأخطاء**: `{ statusCode, error, message, timestamp, path }`.

---

## المصادقة `auth`

| الطريقة | المسار | الوصول | الوصف |
|---|---|---|---|
| POST | `/auth/register` | عام | تسجيل متجر جديد + مالكه |
| POST | `/auth/login` | عام | تسجيل الدخول |
| POST | `/auth/refresh` | عام | تدوير الرموز |
| POST | `/auth/logout` | عام | إبطال refresh token |
| GET | `/auth/me` | مصادَق | المستخدم + المتجر الحاليان |

```jsonc
// POST /auth/register
{ "storeName": "متجري", "name": "اسمي", "email": "me@example.com", "password": "password123" }
// → { accessToken, refreshToken, tokenType, expiresIn, user, merchant }
```

---

## المتجر والمساعد `store`

| الطريقة | المسار | الوصول | الوصف |
|---|---|---|---|
| GET | `/store` | مصادَق | بيانات المتجر |
| PATCH | `/store` | OWNER, ADMIN | تحديث بيانات المتجر |
| GET | `/store/ai-settings` | مصادَق | إعدادات المساعد |
| PATCH | `/store/ai-settings` | OWNER, ADMIN | تحديث إعدادات المساعد |
| DELETE | `/store` | OWNER | حذف المتجر نهائيًا (كل بياناته) |

---

## المستخدمون (الفريق) `users`

جميع مساراتها لـ **OWNER, ADMIN** فقط (STAFF ممنوع).

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/users` | قائمة مستخدمي المتجر |
| POST | `/users` | إضافة مستخدم (`name`, `email`, `password`, `role`) — منح دور OWNER للمالك فقط |
| PATCH | `/users/:id` | تحديث الاسم/الدور/التفعيل |
| DELETE | `/users/:id` | تعطيل مستخدم (لا يشمل المالك ولا الحساب الحالي) |

---

## سجلّ التدقيق `audit-logs`

لـ **OWNER, ADMIN** فقط، ومحصور بنطاق المتجر. راجع `docs/SECURITY.md`.

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/audit-logs` | أحدث أحداث التدقيق. مُعاملات: `limit` (1–100)، `cursor`، `action` |

يسجّل النظام: `AUTH_LOGIN_SUCCESS/FAILED`، `AUTH_REGISTER`، `AUTH_LOGOUT`، `USER_CREATE/UPDATE/DEACTIVATE`، `SUBSCRIPTION_CHANGE`، `PLAN_EDIT`، `STORE_DELETE`، `BOT_CONFIGURE/DELETE`. لا تُسجَّل أي أسرار.

---

## المنتجات `products`

> ملاحظة: `storeId` في المواصفة هو `merchantId` في المخطط (المتجر = Merchant).

| الطريقة | المسار | الوصول | الوصف |
|---|---|---|---|
| GET | `/products` | مصادَق | قائمة مع بحث/فلترة/ترتيب |
| GET | `/products/categories` | مصادَق | التصنيفات المستخدمة (لعناصر الفلترة) |
| POST | `/products` | OWNER, ADMIN, STAFF | إنشاء منتج |
| POST | `/products/upload` | OWNER, ADMIN, STAFF | رفع صورة (`multipart/form-data`، الحقل `file`) — يعيد `{ url }` |
| GET | `/products/:id` | مصادَق | تفاصيل منتج |
| PUT | `/products/:id` | OWNER, ADMIN, STAFF | تعديل |
| PATCH | `/products/:id` | OWNER, ADMIN, STAFF | تعديل جزئي |
| DELETE | `/products/:id?permanent=true` | OWNER, ADMIN, STAFF | أرشفة (افتراضي) أو حذف نهائي |

معاملات القائمة: `search`, `status`, `category`, `tag`, `minPrice`, `maxPrice`, `sortBy` (`createdAt`/`price`/`name`/`stock`), `sortOrder`, `page`, `limit`.

الحالات: `ACTIVE` · `OUT_OF_STOCK` · `HIDDEN` · `ARCHIVED` (تُضبط ACTIVE↔OUT_OF_STOCK تلقائيًا حسب المخزون).

```jsonc
// POST /products
{
  "name": "قميص قطني",
  "category": "ملابس",
  "price": 25,
  "oldPrice": 30,
  "currency": "USD",
  "stock": 40,
  "sku": "SH-001",
  "status": "ACTIVE",
  "imageUrl": "https://api.example.com/uploads/....png",
  "tags": ["ملابس", "صيف"]
}
```

---

## المخزون `inventory`

| الطريقة | المسار | الوصف |
|---|---|---|
| POST | `/inventory/adjust` | تعديل مخزون منتج (`quantity` موجب/سالب، `type`) |
| GET | `/inventory/movements` | سجلّ الحركات (فلتر `productId`) |

---

## الطلبات `orders`

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/orders` | قائمة (فلاتر `status`, `source`, `search`) |
| POST | `/orders` | إنشاء طلب من اللوحة (`items[{productId, quantity}]`، واختياريًا `discount`, `notes`, بيانات العميل) |
| GET | `/orders/:id` | تفاصيل الطلب (العناصر + المجموع الفرعي + الخصم + الإجمالي + بيانات العميل) |
| PATCH | `/orders/:id/status` | تغيير الحالة (يُعيد المخزون عند الإلغاء) |

الحالات: `PENDING` · `CONFIRMED` · `PROCESSING` · `SHIPPED` · `COMPLETED` · `CANCELLED`.

> الأسعار والإجمالي تُحسب من قاعدة البيانات؛ لا تُرسل أسعارًا من العميل. الإجمالي = المجموع الفرعي − الخصم.

---

## العملاء `customers`

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/customers` | قائمة العملاء |
| GET | `/customers/:id` | تفاصيل + آخر الطلبات |
| PATCH | `/customers/:id` | تحديث الهاتف/الملاحظات |

---

## المحادثات `conversations`

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/conversations` | قائمة (اسم العميل، المعرّف، آخر رسالة، آخر نشاط، الحالة، الطلب المرتبط) |
| GET | `/conversations/:id` | المحادثة + رسائلها + الطلبات المرتبطة |
| PATCH | `/conversations/:id/status` | تغيير الحالة — «التولّي» بضبط `HUMAN_ACTIVE`، والإعادة بضبط `AI_ACTIVE` |

الحالات: `AI_ACTIVE` (المساعد نشط) · `WAITING_FOR_HUMAN` (بانتظار موظف) · `HUMAN_ACTIVE` (موظف يتولّى — البوت متوقف عن الردّ) · `CLOSED`.

---

## الأسئلة الشائعة `faqs`

| الطريقة | المسار | الوصول |
|---|---|---|
| GET | `/faqs` | مصادَق |
| POST | `/faqs` | OWNER, ADMIN |
| GET | `/faqs/:id` | مصادَق |
| PATCH | `/faqs/:id` | OWNER, ADMIN |
| DELETE | `/faqs/:id` | OWNER, ADMIN |

---

## قاعدة المعرفة `knowledge`

| الطريقة | المسار | الوصول |
|---|---|---|
| GET | `/knowledge` | مصادَق (فلتر `category`, `search`) |
| POST | `/knowledge` | OWNER, ADMIN |
| GET | `/knowledge/:id` | مصادَق |
| PUT | `/knowledge/:id` | OWNER, ADMIN |
| PATCH | `/knowledge/:id` | OWNER, ADMIN |
| DELETE | `/knowledge/:id` | OWNER, ADMIN |

التصنيفات: `STORE_INFO` · `SHIPPING` · `EXCHANGE` · `RETURN` · `PAYMENT` · `WORKING_HOURS` · `CONTACT` · `TERMS` · `FAQ` · `OTHER`. يستخدمها المساعد عبر الاسترجاع (RAG)، ومعزولة لكل متجر بـ `merchantId`.

---

## الذكاء الاصطناعي `ai`

| الطريقة | المسار | الوصف |
|---|---|---|
| POST | `/ai/preview` | معاينة المساعد (لا يُنشئ طلبات ولا يُحتسب استخدامًا) |

```jsonc
// POST /ai/preview
{ "message": "هل يتوفّر قميص قطني؟" }
// → { reply, disabled, handoff, toolTrace }
```

---

## بوت تيليجرام `telegram`

| الطريقة | المسار | الوصول | الوصف |
|---|---|---|---|
| POST | `/telegram/webhook/:merchantId` | عام (سرّ) | استقبال تحديثات تيليجرام |
| GET | `/telegram/config` | مصادَق | حالة البوت |
| PUT | `/telegram/config` | OWNER, ADMIN | ربط البوت (`botToken`, `ownerChatId?`) |
| POST | `/telegram/activate` | OWNER, ADMIN | تفعيل |
| POST | `/telegram/deactivate` | OWNER, ADMIN | إيقاف |
| DELETE | `/telegram/config` | OWNER | إلغاء الربط |
| POST | `/telegram/reply` | OWNER, ADMIN, STAFF | ردّ صاحب المتجر على العميل داخل المحادثة (`conversationId`, `message`) |

---

## الاشتراكات `subscriptions`

| الطريقة | المسار | الوصول | الوصف |
|---|---|---|---|
| GET | `/subscriptions/plans` | مصادَق | قائمة الخطط |
| GET | `/subscriptions/me` | مصادَق | اشتراك المتجر الحالي (يتضمّن `active`, `status`, `currentPeriodEnd`, `plan.features`) |
| GET | `/subscriptions/usage` | مصادَق | استخدام الشهر الحالي |
| POST | `/subscriptions/change` | OWNER | تغيير الخطة (`tier`) |

### الخطط الافتراضية

| الخطة | السعر/شهر | رسائل/شهر | المنتجات | الفريق | الميزات |
|---|---|---|---|---|---|
| FREE | $0 | 100 | 50 | 1 | لوحة أساسية |
| STARTER | $5 | 500 | 500 | 2 | + الطلبات، قاعدة المعرفة، التحليلات |
| PRO | $12 | 2000 | غير محدود | غير محدود | + تحليلات متقدمة، فريق متعدد، دعم أولوية |
| BUSINESS | $29 | 10000 | غير محدود | غير محدود | + متاجر متعددة، وصول API، ذكاء متقدم |

> القيمة `-1` في الحدود تعني «غير محدود». تُنشأ الخطط مرّة واحدة (`ensureDefaults` بأسلوب create-only) ثم تبقى تعديلات المشرف محفوظة.

**تقييد الميزات (feature gating):** كل ميزة مدفوعة تُتحقَّق عبر `SubscriptionsService.assertFeature(merchantId, feature, label)`. الميزات المرتبطة: `orders` (إنشاء الطلبات)، `knowledgeBase` (إضافة/تعديل المعرفة)، `analytics` (السلاسل الزمنية في التحليلات)، وحدّ الفريق `staffLimit` (عند إضافة مستخدم).

**عند انتهاء/إلغاء الاشتراك:** لا تُحذف أي بيانات. تُرجع `getEffectivePlan` خطة FREE فتُوقَف الميزات المدفوعة تلقائيًا، ويظلّ بإمكان المالك الترقية. اللوحة الرئيسية تبقى تعمل للجميع لأن جلب السلاسل الزمنية مُغلّف بـ `.catch`.

---

## لوحة المشرف الأعلى — عابرة للمتاجر `admin`

جميع المسارات محميّة بـ `PlatformAdminGuard` (البريد ضمن `PLATFORM_ADMIN_EMAILS`) فوق حارس JWT. تعمل على مستوى المنصّة كلها (كل المتاجر). تُقدّمها لوحة منفصلة (تطبيق `apps/admin`). كل الإجراءات المؤثّرة تُسجَّل في التدقيق.

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/admin/overview` | مؤشّرات المنصّة (مستخدمون، متاجر، اشتراكات، إيرادات، رسائل ذكاء) |
| GET | `/admin/health` | صحّة النظام (قاعدة البيانات، مدة التشغيل، الذاكرة) |
| GET | `/admin/users` | كل المستخدمين. مُعاملات: `search`, `limit`, `cursor` |
| PATCH | `/admin/users/:id/suspend` | تعليق مستخدم |
| PATCH | `/admin/users/:id/activate` | تفعيل مستخدم |
| GET | `/admin/stores` | كل المتاجر (مع المالك والخطة والإحصاءات) |
| PATCH | `/admin/stores/:id/suspend` | تعليق متجر (يوقف الدخول والبوت دون حذف بيانات) |
| PATCH | `/admin/stores/:id/activate` | تفعيل متجر |
| GET | `/admin/subscriptions` | كل الاشتراكات. مُعامل: `status` |
| PATCH | `/admin/subscriptions/:merchantId` | تغيير خطة/حالة اشتراك متجر (`tier`, `status`) |
| GET | `/admin/payments` | سجلّ المدفوعات. مُعامل: `status` |
| GET | `/admin/orders` | كل الطلبات عبر المتاجر. مُعاملات: `status`, `search` |
| GET | `/admin/ai-usage` | استخدام الذكاء لكل متجر. مُعامل: `period` (YYYY-MM) |
| GET | `/admin/audit-logs` | سجلّ التدقيق العام. مُعاملات: `action`, `merchantId` |
| GET | `/admin/errors` | أخطاء الخادم (5xx) المسجّلة |
| GET | `/admin/reports` | تقارير: الإيراد حسب الخطة، أعلى المتاجر، النموّ |

> تعليق المتجر يجعل `merchant.isActive=false`: يُرفض دخول مستخدميه (برسالة صريحة بعد المصادقة)، ويتوقّف بوت تيليجرام عن الرد — **دون حذف أي بيانات**، ويمكن التفعيل لاحقًا.

---

## إدارة الخطط — مشرف المنصّة `admin/plans`

الوصول مقصور على مشرفي المنصّة عبر `PlatformAdminGuard` (البريد ضمن `PLATFORM_ADMIN_EMAILS`).

| الطريقة | المسار | الوصول | الوصف |
|---|---|---|---|
| GET | `/admin/plans` | مشرف المنصّة | قائمة الخطط للتحرير |
| PATCH | `/admin/plans/:tier` | مشرف المنصّة | تعديل خطة: `priceMonthly`, `monthlyMessageLimit`, `productLimit`, `staffLimit`, `isActive`, `features` |

الحقل `isPlatformAdmin` يظهر في `GET /auth/me` ليُفعّل واجهة تعديل الأسعار في صفحة الاشتراك.

---

## الدفع `payments`

| الطريقة | المسار | الوصول | الوصف |
|---|---|---|---|
| POST | `/payments/checkout` | OWNER | إنشاء جلسة دفع اشتراك (`tier`) — يرجع رابط الدفع |
| POST | `/payments/webhook` | عام (توقيع) | استقبال أحداث المزوّد وتفعيل الخطة تلقائيًا |

> عند `PAYMENT_PROVIDER=none` تتراجع صفحة الاشتراك تلقائيًا إلى `POST /subscriptions/change` للترقية اليدوية.

---

## الإحصائيات `analytics`

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/analytics/overview` | ملخّص شامل: مبيعات، طلبات (+قيد الانتظار)، عملاء، محادثات، معدّل تحويل، رسائل المساعد، منتجات، أفضل المنتجات، أحدث الطلبات والمحادثات |
| GET | `/analytics/series?days=30` | سلسلة زمنية يومية: الطلبات، الإيرادات، العملاء الجدد، رسائل المساعد |
| GET | `/analytics/metrics?range=30d` | محرّك التحليلات — كل المؤشّرات لنطاق زمني (ميزة `analytics`) |

**محرّك التحليلات `/analytics/metrics`:** المُعامل `range` = `today` \| `7d` \| `30d` \| `all` (افتراضي `30d`). يُعيد لكل نطاق: الرسائل الواردة (`messages`)، ردود الذكاء (`aiResponses`)، الطلبات (`orders`)، المكتملة (`completedOrders`)، الملغاة (`cancelledOrders`)، الإيرادات (`revenue`)، المحادثات (`conversations`)، **معدّل التحويل** (`conversionRate` = الطلبات المكتملة ÷ المحادثات ×100)، متوسط قيمة الطلب (`averageOrderValue`)، العملاء النشطون (`activeCustomers`)، وأفضل المنتجات (`topProducts`). الإيرادات ومتوسط قيمة الطلب يُحتسبان من الطلبات غير الملغاة.

---

## الإشعارات `notifications`

نظام إشعارات عبر **تيليجرام** + موجز محفوظ في اللوحة لصاحب المتجر.

| الطريقة | المسار | الوصول | الوصف |
|---|---|---|---|
| GET | `/notifications` | مصادَق | موجز الإشعارات. مُعاملات: `limit`, `cursor`, `unreadOnly` |
| GET | `/notifications/unread-count` | مصادَق | عدد غير المقروء (ويُشغّل الفحوص الزمنية بمنع تكرار) |
| PATCH | `/notifications/:id/read` | مصادَق | تعليم إشعار كمقروء |
| POST | `/notifications/read-all` | مصادَق | تعليم الكل كمقروء |
| POST | `/notifications/run-checks` | OWNER/ADMIN | تشغيل فحوص الاشتراك/الاستخدام يدويًا أو بالجدولة اليومية |

**إشعارات صاحب المتجر** (تُخزَّن + تُرسَل لـ ownerChatId): طلب جديد (`NEW_ORDER`)، عميل جديد (`NEW_CUSTOMER`)، طلب تدخّل بشري (`HUMAN_ASSISTANCE_REQUIRED`)، مخزون منخفض (`LOW_STOCK`، عند عبور `lowStockThreshold`)، اشتراك يقارب الانتهاء (`SUBSCRIPTION_EXPIRING`، خلال ٣ أيام)، اقتراب حد الاستخدام (`USAGE_LIMIT_NEAR`، عند 80% من حد الرسائل).

**إشعارات العميل** (تُرسَل عبر تيليجرام لحظيًا عند إنشاء الطلب/تغيّر حالته): تم الإنشاء، تم التأكيد، قيد التجهيز، تم الشحن، اكتمل، أُلغي.

> «طلب جديد/تم الإنشاء» و«تغيّر الحالة» تُطلق مركزيًا من `OrdersService`. «عميل جديد» من `CustomersService` عند أول ظهور. «تدخّل بشري» عند تحوّل المحادثة إلى `WAITING_FOR_HUMAN`. «اقتراب الحد» لحظيًا من عدّاد الرسائل. «اقتراب الانتهاء» عبر الفحوص الزمنية (يُنصح بجدولة `POST /notifications/run-checks` يوميًا).

---

## الصحّة `health`

| الطريقة | المسار | الوصول | الوصف |
|---|---|---|---|
| GET | `/health` | عام | حالة الخدمة وقاعدة البيانات |

</div>

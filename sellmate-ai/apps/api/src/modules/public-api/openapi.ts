/**
 * مواصفة OpenAPI 3.0 لواجهة REST العامة (/api).
 * تُقدَّم عبر GET /api/openapi.json وتُعرَض تفاعليًا في GET /api/docs.
 */

const bearer = [{ bearerAuth: [] as string[] }];
const errorResponse = { description: 'خطأ', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };

const paginated = (ref: string) => ({
  type: 'object',
  properties: {
    items: { type: 'array', items: { $ref: `#/components/schemas/${ref}` } },
    meta: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
        hasNextPage: { type: 'boolean' },
      },
    },
  },
});

const json = (schema: unknown) => ({ 'application/json': { schema } });
const ok = (schema: unknown, description = 'نجاح') => ({ description, content: json(schema) });

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SellMate AI — REST API',
    version: '1.0.0',
    description:
      'واجهة REST لمنصّة SellMate AI (مساعد مبيعات تيليجرام). المصادقة عبر JWT Bearer. ' +
      'كل المسارات المحميّة تتطلّب ترويسة `Authorization: Bearer <accessToken>`. ' +
      'الأخطاء تُعاد بصيغة موحّدة، ولا تتضمّن تفاصيل داخلية أو stack traces.',
  },
  servers: [{ url: '/api', description: 'القاعدة العامة' }],
  security: bearer,
  tags: [
    { name: 'Authentication' },
    { name: 'Products' },
    { name: 'Orders' },
    { name: 'Customers' },
    { name: 'Conversations' },
    { name: 'Analytics' },
    { name: 'Subscription' },
    { name: 'Webhooks' },
  ],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'تسجيل متجر جديد ومالكه',
        security: [],
        requestBody: { required: true, content: json({ $ref: '#/components/schemas/RegisterRequest' }) },
        responses: { '201': ok({ $ref: '#/components/schemas/AuthResponse' }), '409': errorResponse, '400': errorResponse },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'تسجيل الدخول',
        security: [],
        requestBody: { required: true, content: json({ $ref: '#/components/schemas/LoginRequest' }) },
        responses: { '200': ok({ $ref: '#/components/schemas/AuthResponse' }), '401': errorResponse },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'إبطال رمز التحديث (تسجيل الخروج)',
        security: [],
        requestBody: { required: true, content: json({ $ref: '#/components/schemas/LogoutRequest' }) },
        responses: { '200': ok({ type: 'object', properties: { success: { type: 'boolean' } } }) },
      },
    },
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'قائمة المنتجات',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'OUT_OF_STOCK', 'HIDDEN', 'ARCHIVED'] } },
        ],
        responses: { '200': ok(paginated('Product')), '401': errorResponse },
      },
      post: {
        tags: ['Products'],
        summary: 'إنشاء منتج',
        requestBody: { required: true, content: json({ $ref: '#/components/schemas/CreateProduct' }) },
        responses: { '201': ok({ $ref: '#/components/schemas/Product' }), '400': errorResponse, '403': errorResponse },
      },
    },
    '/products/{id}': {
      put: {
        tags: ['Products'],
        summary: 'تحديث منتج',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json({ $ref: '#/components/schemas/CreateProduct' }) },
        responses: { '200': ok({ $ref: '#/components/schemas/Product' }), '404': errorResponse },
      },
      delete: {
        tags: ['Products'],
        summary: 'حذف/أرشفة منتج',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'permanent', in: 'query', schema: { type: 'boolean' }, description: 'true للحذف النهائي بدل الأرشفة' },
        ],
        responses: { '200': ok({ type: 'object', properties: { success: { type: 'boolean' } } }), '404': errorResponse },
      },
    },
    '/orders': {
      get: {
        tags: ['Orders'],
        summary: 'قائمة الطلبات',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': ok(paginated('Order')), '401': errorResponse },
      },
      post: {
        tags: ['Orders'],
        summary: 'إنشاء طلب',
        requestBody: { required: true, content: json({ $ref: '#/components/schemas/CreateOrder' }) },
        responses: { '201': ok({ $ref: '#/components/schemas/Order' }), '400': errorResponse },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'طلب واحد',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': ok({ $ref: '#/components/schemas/Order' }), '404': errorResponse },
      },
      put: {
        tags: ['Orders'],
        summary: 'تحديث حالة الطلب',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['status'],
            properties: { status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'] } },
          }),
        },
        responses: { '200': ok({ $ref: '#/components/schemas/Order' }), '404': errorResponse },
      },
    },
    '/customers': {
      get: {
        tags: ['Customers'],
        summary: 'قائمة العملاء',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': ok(paginated('Customer')), '401': errorResponse },
      },
    },
    '/customers/{id}': {
      get: {
        tags: ['Customers'],
        summary: 'عميل واحد',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': ok({ $ref: '#/components/schemas/Customer' }), '404': errorResponse },
      },
    },
    '/conversations': {
      get: {
        tags: ['Conversations'],
        summary: 'قائمة المحادثات',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['AI_ACTIVE', 'WAITING_FOR_HUMAN', 'HUMAN_ACTIVE', 'CLOSED'] } },
        ],
        responses: { '200': ok(paginated('Conversation')), '401': errorResponse },
      },
    },
    '/conversations/{id}': {
      get: {
        tags: ['Conversations'],
        summary: 'محادثة واحدة مع رسائلها',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': ok({ $ref: '#/components/schemas/Conversation' }), '404': errorResponse },
      },
    },
    '/analytics': {
      get: {
        tags: ['Analytics'],
        summary: 'نظرة عامة شاملة على المتجر',
        responses: { '200': ok({ $ref: '#/components/schemas/Analytics' }), '401': errorResponse },
      },
    },
    '/subscription': {
      get: {
        tags: ['Subscription'],
        summary: 'اشتراك المتجر الحالي',
        responses: { '200': ok({ $ref: '#/components/schemas/Subscription' }), '401': errorResponse },
      },
    },
    '/subscription/checkout': {
      post: {
        tags: ['Subscription'],
        summary: 'إنشاء جلسة دفع لترقية الخطة',
        requestBody: {
          required: true,
          content: json({ type: 'object', required: ['tier'], properties: { tier: { type: 'string', enum: ['FREE', 'STARTER', 'PRO', 'BUSINESS'] } } }),
        },
        responses: { '201': ok({ type: 'object', properties: { id: { type: 'string' }, url: { type: 'string', nullable: true } } }), '403': errorResponse },
      },
    },
    '/subscription/cancel': {
      post: {
        tags: ['Subscription'],
        summary: 'إلغاء التجديد التلقائي (يبقى الوصول حتى نهاية الفترة)',
        responses: { '200': ok({ $ref: '#/components/schemas/Subscription' }), '403': errorResponse },
      },
    },
    '/webhooks/telegram': {
      post: {
        tags: ['Webhooks'],
        summary: 'استقبال تحديثات تيليجرام (يُستدعى من تيليجرام)',
        security: [],
        parameters: [
          { name: 'merchantId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'x-telegram-bot-api-secret-token', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: json({ type: 'object', additionalProperties: true }) },
        responses: { '200': ok({ type: 'object', properties: { ok: { type: 'boolean' } } }), '401': errorResponse },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          statusCode: { type: 'integer' },
          error: { type: 'string' },
          message: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string' },
          requestId: { type: 'string', description: 'يظهر لأخطاء الخادم (5xx) للتتبّع' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['storeName', 'name', 'email', 'password'],
        properties: {
          storeName: { type: 'string', example: 'متجري' },
          name: { type: 'string', example: 'أحمد' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, description: '8–128 حرفًا، حرف ورقم على الأقل' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
      },
      LogoutRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', example: 900 },
          user: { type: 'object', additionalProperties: true },
          merchant: { type: 'object', nullable: true, additionalProperties: true },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          category: { type: 'string', nullable: true },
          price: { type: 'string', example: '49.99' },
          oldPrice: { type: 'string', nullable: true },
          currency: { type: 'string', nullable: true },
          stock: { type: 'integer' },
          lowStockThreshold: { type: 'integer' },
          status: { type: 'string', enum: ['ACTIVE', 'OUT_OF_STOCK', 'HIDDEN', 'ARCHIVED'] },
          imageUrl: { type: 'string', nullable: true },
          tags: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateProduct: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name: { type: 'string', maxLength: 200 },
          description: { type: 'string', maxLength: 5000 },
          category: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          oldPrice: { type: 'number', minimum: 0 },
          currency: { type: 'string' },
          stock: { type: 'integer', minimum: 0 },
          lowStockThreshold: { type: 'integer', minimum: 0 },
          sku: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'OUT_OF_STOCK', 'HIDDEN', 'ARCHIVED'] },
          imageUrl: { type: 'string', format: 'uri' },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 30 },
        },
      },
      CreateOrder: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: { productId: { type: 'string' }, quantity: { type: 'integer', minimum: 1 } },
            },
          },
          customerId: { type: 'string' },
          customerName: { type: 'string' },
          customerPhone: { type: 'string' },
          customerAddress: { type: 'string' },
          notes: { type: 'string', maxLength: 1000 },
          discount: { type: 'number', minimum: 0 },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          number: { type: 'string', example: 'SM-20260814-AB12C' },
          status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'] },
          currency: { type: 'string' },
          subtotal: { type: 'string' },
          discount: { type: 'string' },
          total: { type: 'string' },
          customerName: { type: 'string', nullable: true },
          customerPhone: { type: 'string', nullable: true },
          customerAddress: { type: 'string', nullable: true },
          items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          telegramId: { type: 'string' },
          username: { type: 'string', nullable: true },
          firstName: { type: 'string', nullable: true },
          lastName: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          lastSeenAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Conversation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['AI_ACTIVE', 'WAITING_FOR_HUMAN', 'HUMAN_ACTIVE', 'CLOSED'] },
          channel: { type: 'string' },
          lastMessageAt: { type: 'string', format: 'date-time' },
          customer: { type: 'object', additionalProperties: true },
          messages: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
      Analytics: {
        type: 'object',
        description: 'نظرة عامة: مبيعات، طلبات، عملاء، محادثات، معدّل تحويل، استخدام، أفضل المنتجات.',
        additionalProperties: true,
      },
      Subscription: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] },
          active: { type: 'boolean' },
          currentPeriodEnd: { type: 'string', format: 'date-time' },
          cancelAtPeriodEnd: { type: 'boolean' },
          plan: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
};

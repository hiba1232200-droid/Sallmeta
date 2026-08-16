import { z } from 'zod';

/**
 * مخطط التحقق من متغيرات البيئة. يمنع تشغيل التطبيق بإعداد ناقص أو خاطئ.
 * لا تضع أي مفتاح API داخل الكود — كلها تُقرأ من هنا فقط.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),

  // عناوين عامة
  APP_URL: z.string().url().default('http://localhost:3000'), // عنوان لوحة التحكم (للـ CORS والروابط)
  WEBHOOK_URL: z.string().url().default('http://localhost:4000'), // عنوان الـ API العام (لـ webhook تيليجرام)
  CORS_ORIGINS: z.string().optional().default(''), // إن تُرك فارغًا يُستخدم APP_URL

  // قاعدة البيانات و Redis
  DATABASE_URL: z.string().min(1, 'DATABASE_URL مطلوب'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // المصادقة — سرّ واحد أساسي، ويُشتقّ منه سرّ التحديث
  JWT_SECRET: z.string().min(16, 'JWT_SECRET قصير جدًا (16 حرفًا فأكثر)'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(1209600),

  // حدود المعدل
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  // تيليجرام
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''), // بوت افتراضي/منصّة (اختياري؛ كل متجر يربط بوته)
  TELEGRAM_WEBHOOK_SECRET: z.string().min(8, 'TELEGRAM_WEBHOOK_SECRET قصير جدًا'),

  // تشفير الأسرار at-rest (base64 لـ 32 بايت)
  ENCRYPTION_KEY: z.string().optional().default(''),

  // الذكاء الاصطناعي — مزوّد قابل للتبديل
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'gemini', 'none']).default('none'),
  AI_API_KEY: z.string().optional().default(''), // مفتاح عام يصلح للمزوّد المختار
  AI_MODEL: z.string().optional().default(''), // تجاوز اختياري لاسم الموديل
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(800),
  AI_MAX_TOOL_ITERATIONS: z.coerce.number().int().positive().max(12).default(5),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-latest'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

  // الدفع — مزوّد قابل للتبديل
  PAYMENT_PROVIDER: z.enum(['stripe', 'none']).default('none'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),

  // بريد مشرفي المنصّة (يعدّلون أسعار الخطط) — مفصولة بفواصل
  PLATFORM_ADMIN_EMAILS: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

/** يحلّ مفتاح مزوّد الذكاء الاصطناعي: المفتاح الخاص إن وُجد، وإلا المفتاح العام. */
export function resolveAiKey(env: Env): string {
  switch (env.AI_PROVIDER) {
    case 'openai':
      return env.OPENAI_API_KEY || env.AI_API_KEY;
    case 'anthropic':
      return env.ANTHROPIC_API_KEY || env.AI_API_KEY;
    case 'gemini':
      return env.GEMINI_API_KEY || env.AI_API_KEY;
    default:
      return '';
  }
}

/** تُمرَّر إلى @nestjs/config كدالة validate. ترمي خطأ واضحًا عند الفشل. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`إعداد البيئة غير صالح:\n${issues}`);
  }
  const env = parsed.data;

  if (env.AI_PROVIDER !== 'none' && !resolveAiKey(env)) {
    throw new Error(
      `AI_PROVIDER=${env.AI_PROVIDER} لكن لا يوجد مفتاح. اضبط AI_API_KEY أو مفتاح المزوّد الخاص.`,
    );
  }
  if (env.PAYMENT_PROVIDER === 'stripe' && !env.STRIPE_SECRET_KEY) {
    throw new Error('PAYMENT_PROVIDER=stripe لكن STRIPE_SECRET_KEY غير موجود');
  }
  if (env.ENCRYPTION_KEY) {
    const bytes = Buffer.from(env.ENCRYPTION_KEY, 'base64');
    if (bytes.length !== 32) {
      throw new Error('ENCRYPTION_KEY يجب أن يكون base64 لـ 32 بايت (openssl rand -base64 32)');
    }
  }

  // تشديدات إضافية في الإنتاج: أسرار قوية وإلزامية.
  if (env.NODE_ENV === 'production') {
    if (env.JWT_SECRET.length < 32) {
      throw new Error('في الإنتاج يجب أن يكون JWT_SECRET 32 حرفًا فأكثر (openssl rand -base64 48)');
    }
    if (!env.ENCRYPTION_KEY) {
      throw new Error(
        'في الإنتاج يجب ضبط ENCRYPTION_KEY لتشفير رموز البوتات at-rest (openssl rand -base64 32)',
      );
    }
    if (env.TELEGRAM_WEBHOOK_SECRET.length < 16) {
      throw new Error('في الإنتاج يجب أن يكون TELEGRAM_WEBHOOK_SECRET 16 حرفًا فأكثر');
    }
    // منع الأسرار الافتراضية/الضعيفة الشائعة.
    const weak = ['change-me', 'changeme', 'secret', 'password', 'dev', 'test'];
    if (weak.some((w) => env.JWT_SECRET.toLowerCase().includes(w))) {
      throw new Error('JWT_SECRET يبدو قيمة افتراضية/ضعيفة — استخدم سرًّا عشوائيًا قويًا في الإنتاج');
    }
  }

  return env;
}

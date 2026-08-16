import { createHash } from 'node:crypto';
import { envSchema, resolveAiKey } from './env.validation';

/**
 * يحوّل متغيرات البيئة إلى شجرة إعدادات مُصنّفة (typed).
 * نُعيد التحليل عبر zod هنا لضمان تطبيق القيم الافتراضية والتحويلات.
 */
export const configuration = () => {
  const env = envSchema.parse(process.env);

  // سرّ التحديث يُشتقّ من JWT_SECRET ليكون مختلفًا عن سرّ الوصول (أمان أفضل بسرّ واحد).
  const refreshSecret = createHash('sha256').update(`${env.JWT_SECRET}:refresh`).digest('hex');

  const corsOrigins = (env.CORS_ORIGINS || env.APP_URL)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.API_PORT,
    corsOrigins,
    app: {
      url: env.APP_URL,
      apiUrl: env.WEBHOOK_URL,
    },
    database: {
      url: env.DATABASE_URL,
    },
    redis: {
      url: env.REDIS_URL,
    },
    jwt: {
      accessSecret: env.JWT_SECRET,
      refreshSecret,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    throttle: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
    },
    telegram: {
      webhookBaseUrl: env.WEBHOOK_URL,
      webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
      defaultBotToken: env.TELEGRAM_BOT_TOKEN,
    },
    security: {
      encryptionKey: env.ENCRYPTION_KEY,
    },
    ai: {
      provider: env.AI_PROVIDER,
      apiKey: resolveAiKey(env),
      model: env.AI_MODEL,
      temperature: env.AI_TEMPERATURE,
      maxTokens: env.AI_MAX_TOKENS,
      maxToolIterations: env.AI_MAX_TOOL_ITERATIONS,
      openai: { model: env.OPENAI_MODEL },
      anthropic: { model: env.ANTHROPIC_MODEL },
      gemini: { model: env.GEMINI_MODEL },
    },
    payments: {
      provider: env.PAYMENT_PROVIDER,
      stripe: {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      },
    },
    platform: {
      adminEmails: (env.PLATFORM_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    },
  };
};

export type AppConfig = ReturnType<typeof configuration>;

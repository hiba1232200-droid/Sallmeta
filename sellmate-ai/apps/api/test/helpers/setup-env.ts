/** متغيّرات بيئة افتراضية للاختبارات (لا أسرار حقيقية). */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-value-please-change-1234567890';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:3000';
process.env.WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:4000';
process.env.TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'test-webhook-secret';
process.env.AI_PROVIDER = process.env.AI_PROVIDER || 'none';
process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'none';
process.env.PLATFORM_ADMIN_EMAILS = process.env.PLATFORM_ADMIN_EMAILS || 'admin@sellmate.ai';

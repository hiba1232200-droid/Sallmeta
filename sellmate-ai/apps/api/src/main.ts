import 'reflect-metadata';
import { Logger, RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ensureUploadsDir, UPLOADS_DIR } from './common/uploads';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaService } from './prisma/prisma.service';

// تسلسل BigInt (مثل telegramId) إلى نص داخل استجابات JSON.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const isProduction = config.get<boolean>('isProduction') === true;

  // خلف وكيل عكسي (nginx/تحميل): نثق بأول وكيل للحصول على IP الحقيقي (للتدقيق وحدود المعدل).
  app.set('trust proxy', 1);

  // ترويسات HTTP آمنة (helmet): CSP صارم، HSTS في الإنتاج، منع التأطير، سياسة referrer.
  app.use(
    helmet({
      // نسمح بتحميل الصور المرفوعة عبر أصل مختلف (لوحة التحكم على نطاق آخر).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // واجهة برمجية تُعيد JSON فقط — نمنع كل شيء افتراضيًا.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'none'"],
        },
      },
      hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // حدود حجم الجسم (تحمي من هجمات الحمل الكبير/DoS). يبقى rawBody متاحًا لتوقيع Stripe.
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });

  // خدمة الملفات المرفوعة بشكل ثابت على /uploads مع منع أي تنفيذ (nosniff + CSP مقيّد).
  ensureUploadsDir();
  app.useStaticAssets(UPLOADS_DIR, {
    prefix: '/uploads/',
    index: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  });
  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  // بادئة ونسخنة المسارات: /api/v1/... — مع استثناء /health (لفحص Railway).
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // تحقّق صارم من المدخلات
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // فلتر الاستثناءات مُسجّل عبر APP_FILTER (لحقن Prisma وتخزين أخطاء 5xx).
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableShutdownHooks();
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  // Railway/الاستضافات تضبط PORT ديناميكيًا؛ نفضّله ونستمع على كل الواجهات.
  const port = process.env.PORT ? Number(process.env.PORT) : (config.get<number>('port') ?? 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`SellMate AI API يعمل على المنفذ ${port} (بيئة: ${config.get('env')})`);
}

bootstrap();

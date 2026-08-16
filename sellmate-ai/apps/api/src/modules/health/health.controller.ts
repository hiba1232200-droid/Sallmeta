import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * فحوص الصحّة (مستبعَدة من البادئة والنسخنة → تُخدَم على /health مباشرة).
 * - GET /health        : liveness — يعيد {"status":"ok"} دائمًا (لفحص Railway).
 * - GET /health/ready  : readiness — يتحقّق من اتصال قاعدة البيانات.
 */
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async ready() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return {
      status: db ? 'ok' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}

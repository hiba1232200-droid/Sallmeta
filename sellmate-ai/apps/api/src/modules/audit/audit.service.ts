import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditActionType } from './audit.constants';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface AuditEntry extends RequestMeta {
  action: AuditActionType;
  merchantId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * تسجيل أحداث التدقيق الأمني (append-only).
 * التسجيل «أفضل جهد»: أي فشل لا يجب أن يُعطّل العملية الأساسية.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          merchantId: entry.merchantId ?? null,
          actorId: entry.actorId ?? null,
          actorEmail: entry.actorEmail ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          ip: entry.ip ? entry.ip.slice(0, 64) : null,
          userAgent: entry.userAgent ? entry.userAgent.slice(0, 256) : null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      // لا نُفشل العملية الأساسية بسبب فشل التدقيق — نكتفي بتسجيله في سجلّ الخادم.
      this.logger.error(
        `فشل كتابة حدث تدقيق (${entry.action})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** قراءة سجلّات متجر معيّن (الأحدث أولًا) مع ترقيم بالمؤشّر. */
  async list(
    merchantId: string,
    opts: { limit: number; cursor?: string; action?: string },
  ) {
    const where: Prisma.AuditLogWhereInput = { merchantId };
    if (opts.action) {
      where.action = opts.action;
    }
    const items = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > opts.limit;
    const page = hasMore ? items.slice(0, opts.limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  requestId?: string;
}

/**
 * فلتر استثناءات موحّد: يحوّل أخطاء HTTP وPrisma والأخطاء العامة إلى استجابة JSON ثابتة الشكل.
 * لا يسرّب تفاصيل داخلية للعميل في أخطاء الخادم، ويُخزّن أخطاء 5xx للمراجعة في لوحة المشرف.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // PrismaService اختياري: قد يُستخدم الفلتر قبل توفّر الحقن في بعض الحالات.
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'حدث خطأ داخلي في الخادم';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const body = res as Record<string, unknown>;
        message = (body.message as string | string[]) ?? message;
        error = (body.error as string) ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      message = mapped.message;
      error = mapped.error;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'بيانات الطلب غير صالحة';
      error = 'ValidationError';
    }

    // لأخطاء الخادم (>=500): نولّد معرّف تتبّع، نسجّل التفاصيل داخليًا فقط،
    // ونُعيد رسالة عامة + المعرّف للعميل (دون أي stack trace أو تفاصيل داخلية).
    let requestId: string | undefined;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      requestId = randomUUID();
      message = 'حدث خطأ داخلي في الخادم';
      error = 'InternalServerError';
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      this.persist(requestId, request, status, exception);
    }

    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId ? { requestId } : {}),
    };
    response.status(status).json(body);
  }

  /** يخزّن خطأ الخادم (5xx) في ErrorLog — أفضل جهد، دون تعطيل الاستجابة. */
  private persist(
    requestId: string,
    request: Request,
    statusCode: number,
    exception: unknown,
  ): void {
    if (!this.prisma) {
      return;
    }
    const merchantId = (request as unknown as { user?: { merchantId?: string } }).user?.merchantId;
    this.prisma.errorLog
      .create({
        data: {
          requestId,
          method: request.method,
          path: request.url?.slice(0, 1024),
          statusCode,
          message:
            exception instanceof Error ? exception.message.slice(0, 2000) : String(exception).slice(0, 2000),
          stack: exception instanceof Error ? exception.stack?.slice(0, 8000) ?? null : null,
          merchantId: merchantId ?? null,
        },
      })
      .catch(() => undefined);
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (e.code) {
      case 'P2002':
        // لا نكشف اسم الحقل/العمود (تفاصيل مخطط) — رسالة عامة فقط.
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'قيمة مكررة موجودة مسبقًا',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'NotFound',
          message: 'السجل المطلوب غير موجود',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'BadRequest',
          message: 'مرجع (foreign key) غير صالح',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'DatabaseError',
          message: 'تعذّر تنفيذ العملية على قاعدة البيانات',
        };
    }
  }
}

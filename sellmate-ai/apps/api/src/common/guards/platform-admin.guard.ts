import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../interfaces';

/**
 * يسمح فقط لمشرفي المنصّة (SellMate) — البريد ضمن PLATFORM_ADMIN_EMAILS.
 * يُستخدم لإدارة الخطط والأسعار على مستوى المنصّة (وليس متجرًا بعينه).
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    const admins = this.config.get<string[]>('platform.adminEmails') ?? [];
    if (!user || !admins.includes(user.email.toLowerCase())) {
      throw new ForbiddenException('هذا الإجراء مقصور على مشرفي المنصّة');
    }
    return true;
  }
}

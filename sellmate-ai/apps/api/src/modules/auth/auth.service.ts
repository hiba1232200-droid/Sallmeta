import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { ARGON2_OPTIONS } from '../../common/security/argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/interfaces';
import { addDays, addSeconds } from '../../common/utils/date.util';
import { slugify } from '../../common/utils/slug.util';
import { PlansService } from '../subscriptions/plans.service';
import { AuditService, RequestMeta } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private dummyHash: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
  ) {}

  /** تسجيل متجر جديد + مالكه + إعدادات AI + اشتراك تجريبي. */
  async register(dto: RegisterDto, meta?: RequestMeta) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('البريد الإلكتروني مستخدم مسبقًا');
    }

    const passwordHash = await hash(dto.password, ARGON2_OPTIONS);
    const slug = await this.uniqueMerchantSlug(dto.storeName);
    const starter = await this.plans.getByTier('STARTER');
    const now = new Date();

    const { user, merchant } = await this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          name: dto.storeName,
          slug,
          aiSettings: {
            create: {
              assistantName: `مساعد ${dto.storeName}`,
              welcomeMessage: `أهلًا بك في ${dto.storeName}! كيف يمكنني مساعدتك اليوم؟`,
            },
          },
          subscription: {
            create: {
              planId: starter.id,
              status: 'TRIALING',
              trialEndsAt: addDays(now, 14),
              currentPeriodEnd: addDays(now, 14),
            },
          },
        },
      });

      const user = await tx.user.create({
        data: {
          merchantId: merchant.id,
          email,
          passwordHash,
          name: dto.name,
          role: 'OWNER',
        },
      });

      return { user, merchant };
    });

    await this.audit.record({
      action: AuditAction.AUTH_REGISTER,
      merchantId: merchant.id,
      actorId: user.id,
      actorEmail: user.email,
      targetType: 'Store',
      targetId: merchant.id,
      ...meta,
    });

    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user: this.toPublicUser(user),
      merchant: { id: merchant.id, name: merchant.name, slug: merchant.slug },
    };
  }

  async login(dto: LoginDto, meta?: RequestMeta) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { merchant: { select: { isActive: true } } },
    });

    // نتحقق دائمًا من تجزئة (حقيقية أو وهمية) لتوحيد زمن الاستجابة ومنع كشف وجود الحساب عبر التوقيت.
    const hashToCheck = user?.isActive ? user.passwordHash : await this.getDummyHash();
    const valid = await verify(hashToCheck, dto.password).catch(() => false);

    // رسالة واحدة عامة لكل الحالات (لا كشف عن وجود البريد أو حالة الحساب).
    if (!user || !user.isActive || !valid) {
      await this.audit.record({
        action: AuditAction.AUTH_LOGIN_FAILED,
        merchantId: user?.merchantId ?? null,
        actorId: user?.id ?? null,
        actorEmail: email,
        ...meta,
      });
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    // المتجر مُعلَّق من مشرف المنصّة: بيانات الدخول صحيحة لكن الوصول موقوف (رسالة صريحة بعد المصادقة).
    if (!user.merchant?.isActive) {
      await this.audit.record({
        action: AuditAction.AUTH_LOGIN_FAILED,
        merchantId: user.merchantId,
        actorId: user.id,
        actorEmail: user.email,
        metadata: { reason: 'store_suspended' },
        ...meta,
      });
      throw new UnauthorizedException('تم تعليق هذا المتجر. يرجى التواصل مع الدعم.');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.record({
      action: AuditAction.AUTH_LOGIN_SUCCESS,
      merchantId: user.merchantId,
      actorId: user.id,
      actorEmail: user.email,
      ...meta,
    });
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  /** تجزئة وهمية تُحسب مرّة وتُخزَّن، لموازنة زمن التحقق عند عدم وجود المستخدم. */
  private async getDummyHash(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = await hash(randomBytes(24).toString('hex'), ARGON2_OPTIONS);
    }
    return this.dummyHash;
  }

  /** تدوير رمز التحديث: يُبطل القديم ويُصدر زوجًا جديدًا. */
  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('انتهت الجلسة أو الرمز غير صالح');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('نوع الرمز غير صالح');
    }

    const tokenHash = this.sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('انتهت الجلسة، يرجى تسجيل الدخول من جديد');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { merchant: { select: { isActive: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('الحساب غير متاح');
    }
    if (!user.merchant?.isActive) {
      throw new UnauthorizedException('تم تعليق هذا المتجر. يرجى التواصل مع الدعم.');
    }
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async logout(refreshToken: string, meta?: RequestMeta) {
    const tokenHash = this.sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (stored) {
      await this.audit.record({
        action: AuditAction.AUTH_LOGOUT,
        actorId: stored.userId,
        ...meta,
      });
    }
    return { success: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { merchant: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const adminEmails = this.config.get<string[]>('platform.adminEmails') ?? [];
    const isPlatformAdmin = adminEmails.includes(user.email.toLowerCase());
    return {
      user: { ...this.toPublicUser(user), isPlatformAdmin },
      merchant: {
        id: user.merchant.id,
        name: user.merchant.name,
        slug: user.merchant.slug,
        currency: user.merchant.currency,
        locale: user.merchant.locale,
      },
    };
  }

  private async issueTokens(user: User) {
    const base = {
      sub: user.id,
      merchantId: user.merchantId,
      role: user.role,
      email: user.email,
    };
    const accessTtl = this.config.get<number>('jwt.accessTtl')!;
    const refreshTtl = this.config.get<number>('jwt.refreshTtl')!;

    const accessToken = await this.jwt.signAsync(
      { ...base, type: 'access' },
      { secret: this.config.get<string>('jwt.accessSecret'), expiresIn: accessTtl },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...base, type: 'refresh' },
      { secret: this.config.get<string>('jwt.refreshSecret'), expiresIn: refreshTtl },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.sha256(refreshToken),
        expiresAt: addSeconds(new Date(), refreshTtl),
      },
    });

    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: accessTtl };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      merchantId: user.merchantId,
    };
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async uniqueMerchantSlug(name: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    for (let i = 0; i < 6; i++) {
      const exists = await this.prisma.merchant.findUnique({ where: { slug } });
      if (!exists) {
        return slug;
      }
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}

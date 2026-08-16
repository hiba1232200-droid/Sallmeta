import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { ARGON2_OPTIONS } from '../../common/security/argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { UsageService } from '../subscriptions/usage.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  /** مستخدمو المتجر الحالي فقط (عزل تام). */
  async list(merchantId: string) {
    const users = await this.prisma.user.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => this.toPublic(u));
  }

  async create(merchantId: string, actorRole: UserRole, dto: CreateUserDto) {
    await this.usage.assertWithinStaffLimit(merchantId);
    const role = dto.role ?? 'STAFF';
    if (role === 'OWNER' && actorRole !== 'OWNER') {
      throw new ForbiddenException('فقط المالك يمكنه إضافة مالك آخر');
    }
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('البريد الإلكتروني مستخدم مسبقًا');
    }
    const passwordHash = await hash(dto.password, ARGON2_OPTIONS);
    const user = await this.prisma.user.create({
      data: { merchantId, email, name: dto.name, passwordHash, role },
    });
    return this.toPublic(user);
  }

  async update(merchantId: string, actorRole: UserRole, id: string, dto: UpdateUserDto) {
    const target = await this.prisma.user.findFirst({ where: { id, merchantId } });
    if (!target) {
      throw new NotFoundException('المستخدم غير موجود');
    }
    // ADMIN لا يعدّل حساب المالك ولا يمنح دور OWNER — ذلك للمالك حصريًا.
    if (actorRole !== 'OWNER' && (target.role === 'OWNER' || dto.role === 'OWNER')) {
      throw new ForbiddenException('لا تملك صلاحية تعديل هذا المستخدم أو منح دور المالك');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, role: dto.role, isActive: dto.isActive },
    });
    return this.toPublic(user);
  }

  async deactivate(merchantId: string, actorRole: UserRole, actorUserId: string, id: string) {
    if (id === actorUserId) {
      throw new ForbiddenException('لا يمكنك تعطيل حسابك');
    }
    const target = await this.prisma.user.findFirst({ where: { id, merchantId } });
    if (!target) {
      throw new NotFoundException('المستخدم غير موجود');
    }
    if (target.role === 'OWNER') {
      throw new ForbiddenException('لا يمكن تعطيل حساب المالك');
    }
    if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
      throw new ForbiddenException();
    }
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  private toPublic(u: User) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    };
  }
}

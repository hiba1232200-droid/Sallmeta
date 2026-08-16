import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, skipTake } from '../../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

interface TelegramProfile {
  telegramId: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** ينشئ العميل أو يحدّثه انطلاقًا من ملف تيليجرام (يُستدعى عند كل رسالة). */
  async upsertFromTelegram(merchantId: string, profile: TelegramProfile): Promise<Customer> {
    const existing = await this.prisma.customer.findUnique({
      where: { merchantId_telegramId: { merchantId, telegramId: profile.telegramId } },
      select: { id: true },
    });
    const customer = await this.prisma.customer.upsert({
      where: {
        merchantId_telegramId: { merchantId, telegramId: profile.telegramId },
      },
      update: {
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        languageCode: profile.languageCode,
        lastSeenAt: new Date(),
      },
      create: {
        merchantId,
        telegramId: profile.telegramId,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        languageCode: profile.languageCode,
      },
    });
    // عميل جديد فقط → إشعار المالك (أفضل جهد).
    if (!existing) {
      await this.notifications.newCustomer(merchantId, customer).catch(() => undefined);
    }
    return customer;
  }

  async findAll(merchantId: string, query: QueryCustomersDto) {
    const { page, limit, search } = query;
    const where: Prisma.CustomerWhereInput = { merchantId };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { lastSeenAt: 'desc' },
        ...skipTake(page, limit),
      }),
      this.prisma.customer.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findOne(merchantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, merchantId },
      include: {
        _count: { select: { orders: true, conversations: true } },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, number: true, status: true, total: true, createdAt: true },
        },
      },
    });
    if (!customer) {
      throw new NotFoundException('العميل غير موجود');
    }
    return customer;
  }

  async update(merchantId: string, id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const existing = await this.prisma.customer.findFirst({ where: { id, merchantId } });
    if (!existing) {
      throw new NotFoundException('العميل غير موجود');
    }
    return this.prisma.customer.update({ where: { id }, data: dto });
  }
}

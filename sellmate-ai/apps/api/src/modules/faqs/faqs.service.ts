import { Injectable, NotFoundException } from '@nestjs/common';
import { Faq, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, skipTake } from '../../common/utils/pagination.util';
import { CreateFaqDto } from './dto/create-faq.dto';
import { QueryFaqsDto } from './dto/query-faqs.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Injectable()
export class FaqsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(merchantId: string, dto: CreateFaqDto): Promise<Faq> {
    return this.prisma.faq.create({
      data: {
        merchantId,
        question: dto.question,
        answer: dto.answer,
        tags: dto.tags ?? [],
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findAll(merchantId: string, query: QueryFaqsDto) {
    const { page, limit, search, isActive } = query;
    const where: Prisma.FaqWhereInput = { merchantId };
    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.faq.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        ...skipTake(page, limit),
      }),
      this.prisma.faq.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findOne(merchantId: string, id: string): Promise<Faq> {
    const faq = await this.prisma.faq.findFirst({ where: { id, merchantId } });
    if (!faq) {
      throw new NotFoundException('السؤال غير موجود');
    }
    return faq;
  }

  async update(merchantId: string, id: string, dto: UpdateFaqDto): Promise<Faq> {
    await this.findOne(merchantId, id);
    return this.prisma.faq.update({ where: { id }, data: dto });
  }

  async remove(merchantId: string, id: string) {
    await this.findOne(merchantId, id);
    await this.prisma.faq.delete({ where: { id } });
    return { success: true };
  }

  /** كل الأسئلة الفعّالة (مصدر معرفة الذكاء الاصطناعي). */
  async listActive(merchantId: string, limit = 50): Promise<Faq[]> {
    return this.prisma.faq.findMany({
      where: { merchantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: Math.min(limit, 100),
    });
  }
}

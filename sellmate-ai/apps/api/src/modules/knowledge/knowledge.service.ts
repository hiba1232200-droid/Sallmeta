import { Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeEntry, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, skipTake } from '../../common/utils/pagination.util';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async create(merchantId: string, dto: CreateKnowledgeDto): Promise<KnowledgeEntry> {
    await this.subscriptions.assertFeature(merchantId, 'knowledgeBase', 'قاعدة المعرفة');
    return this.prisma.knowledgeEntry.create({
      data: {
        merchantId,
        category: dto.category,
        title: dto.title,
        content: dto.content,
        tags: dto.tags ?? [],
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findAll(merchantId: string, query: QueryKnowledgeDto) {
    const { page, limit, search, category } = query;
    const where: Prisma.KnowledgeEntryWhereInput = { merchantId };
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.knowledgeEntry.findMany({
        where,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        ...skipTake(page, limit),
      }),
      this.prisma.knowledgeEntry.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findOne(merchantId: string, id: string): Promise<KnowledgeEntry> {
    const entry = await this.prisma.knowledgeEntry.findFirst({ where: { id, merchantId } });
    if (!entry) {
      throw new NotFoundException('عنصر المعرفة غير موجود');
    }
    return entry;
  }

  async update(merchantId: string, id: string, dto: UpdateKnowledgeDto): Promise<KnowledgeEntry> {
    await this.subscriptions.assertFeature(merchantId, 'knowledgeBase', 'قاعدة المعرفة');
    await this.findOne(merchantId, id);
    return this.prisma.knowledgeEntry.update({ where: { id }, data: dto });
  }

  async remove(merchantId: string, id: string) {
    await this.findOne(merchantId, id);
    await this.prisma.knowledgeEntry.delete({ where: { id } });
    return { success: true };
  }
}

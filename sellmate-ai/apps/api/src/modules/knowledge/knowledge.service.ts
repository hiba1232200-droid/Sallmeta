import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeCategory, KnowledgeEntry, Prisma } from '@prisma/client';
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

  /**
   * يستورد محتوى صفحة ويب إلى قاعدة المعرفة: يجلب الصفحة على الخادم، يحوّلها نصًّا،
   * يقسّمها إلى مقاطع، ويخزّنها كعناصر معرفة يستعملها المساعد عبر الاسترجاع (RAG).
   * أمان: يمنع الروابط الداخلية/الخاصّة (SSRF)، ويفرض مهلة وحدًّا للحجم.
   */
  async importUrl(merchantId: string, rawUrl: string, category?: KnowledgeCategory) {
    await this.subscriptions.assertFeature(merchantId, 'knowledgeBase', 'قاعدة المعرفة');
    const url = this.assertSafeUrl(rawUrl);
    const html = await this.fetchHtml(url);
    const { title, text } = this.extractContent(html, url);
    if (!text || text.length < 20) {
      throw new BadRequestException('تعذّر استخراج محتوى نصّي كافٍ من الرابط.');
    }
    const host = new URL(url).hostname;
    const chunks = this.chunkText(text, 6000);
    const created: KnowledgeEntry[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const entry = await this.prisma.knowledgeEntry.create({
        data: {
          merchantId,
          category: category ?? KnowledgeCategory.STORE_INFO,
          title: chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title,
          content: chunks[i],
          tags: ['مستورد', host],
          isActive: true,
          sortOrder: 0,
        },
      });
      created.push(entry);
    }
    return { imported: created.length, title, host, entries: created };
  }

  /** يتحقّق أنّ الرابط http/https وليس داخليًّا/خاصًّا (حماية SSRF). */
  private assertSafeUrl(raw: string): string {
    let u: URL;
    try {
      u = new URL(raw.trim());
    } catch {
      throw new BadRequestException('رابط غير صالح.');
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new BadRequestException('يُسمح فقط بروابط تبدأ بـ http أو https.');
    }
    const host = u.hostname.toLowerCase();
    const blocked =
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (blocked) {
      throw new BadRequestException('لا يُسمح بروابط داخلية أو خاصّة.');
    }
    return u.toString();
  }

  /** يجلب HTML الصفحة مع مهلة وحدّ حجم ونوع محتوى نصّي. */
  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'user-agent': 'SellMateBot/1.0 (+knowledge-import)' },
      });
      if (!res.ok) {
        throw new BadRequestException(`تعذّر جلب الرابط (HTTP ${res.status}).`);
      }
      const ctype = (res.headers.get('content-type') ?? '').toLowerCase();
      if (
        !ctype.includes('text/html') &&
        !ctype.includes('text/plain') &&
        !ctype.includes('application/xhtml')
      ) {
        throw new BadRequestException('الرابط ليس صفحة نصّية (HTML).');
      }
      const buf = await res.arrayBuffer();
      const slice = buf.byteLength > 2_000_000 ? buf.slice(0, 2_000_000) : buf;
      return Buffer.from(slice).toString('utf8');
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new BadRequestException('تعذّر الوصول إلى الرابط (انتهت المهلة أو خطأ في الشبكة).');
    } finally {
      clearTimeout(timer);
    }
  }

  /** يستخرج العنوان والنصّ القابل للقراءة من HTML (إزالة السكربتات والوسوم). */
  private extractContent(html: string, url: string): { title: string; text: string } {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = titleMatch ? this.decodeEntities(titleMatch[1]).trim() : '';
    if (!title) {
      try {
        title = new URL(url).hostname;
      } catch {
        title = 'صفحة مستوردة';
      }
    }
    title = title.slice(0, 190);
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<head[\s\S]*?<\/head>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    const text = this.decodeEntities(body).replace(/\s+/g, ' ').trim();
    return { title, text };
  }

  /** يفكّ ترميز كيانات HTML الشائعة. */
  private decodeEntities(s: string): string {
    return s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)));
  }

  /** يقسّم النصّ إلى مقاطع بحجم محدّد (بحدّ أقصى للعدد لتفادي الإفراط). */
  private chunkText(text: string, size: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      out.push(text.slice(i, i + size));
    }
    return out.slice(0, 10);
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface KnowledgeChunk {
  id: string;
  source: 'knowledge' | 'faq';
  category?: string;
  title: string;
  content: string;
  score: number;
}

const AR_STOPWORDS = new Set([
  'من', 'في', 'على', 'الى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'ما', 'هل', 'كيف',
  'هي', 'هو', 'ان', 'او', 'ثم', 'قد', 'كل', 'لا', 'نعم', 'عند', 'بعد', 'قبل', 'هناك', 'يوجد',
  'لدي', 'لديكم', 'عندكم', 'ماهي', 'ماهو', 'the', 'and', 'for', 'you',
]);

/**
 * نظام الاسترجاع (RAG): يجلب أكثر عناصر معرفة المتجر صلة بالاستعلام لتغذية المساعد.
 * العزل صارم: كل الاستعلامات مقيّدة بـ merchantId، ونرفض أي استدعاء بلا merchantId،
 * فلا يمكن لمساعد متجر الوصول إلى بيانات متجر آخر إطلاقًا.
 */
@Injectable()
export class RetrievalService {
  constructor(private readonly prisma: PrismaService) {}

  async retrieve(merchantId: string, query: string, limit = 5): Promise<KnowledgeChunk[]> {
    if (!merchantId) {
      throw new Error('RetrievalService: merchantId مطلوب — منع أي وصول عابر بين المتاجر');
    }
    const tokens = this.tokenize(query);

    const [entries, faqs] = await Promise.all([
      this.prisma.knowledgeEntry.findMany({
        where: { merchantId, isActive: true },
        take: 500,
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.faq.findMany({
        where: { merchantId, isActive: true },
        take: 500,
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const corpus = [
      ...entries.map((e) => ({
        id: e.id,
        source: 'knowledge' as const,
        category: e.category as string,
        title: e.title,
        content: e.content,
        haystack: this.normalize(`${e.title} ${e.content} ${e.tags.join(' ')}`),
      })),
      ...faqs.map((f) => ({
        id: f.id,
        source: 'faq' as const,
        category: 'FAQ',
        title: f.question,
        content: f.answer,
        haystack: this.normalize(`${f.question} ${f.answer} ${f.tags.join(' ')}`),
      })),
    ];

    if (!tokens.length) {
      return corpus.slice(0, limit).map((c) => this.toChunk(c, 0));
    }

    return corpus
      .map((c) => ({ c, score: this.score(tokens, c.haystack) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => this.toChunk(s.c, s.score));
  }

  private toChunk(
    c: { id: string; source: 'knowledge' | 'faq'; category?: string; title: string; content: string },
    score: number,
  ): KnowledgeChunk {
    return {
      id: c.id,
      source: c.source,
      category: c.category,
      title: c.title,
      content: c.content,
      score,
    };
  }

  private tokenize(text: string): string[] {
    return this.normalize(text)
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !AR_STOPWORDS.has(t));
  }

  private score(tokens: string[], haystack: string): number {
    let score = 0;
    let matchedDistinct = 0;
    for (const token of tokens) {
      const occurrences = this.countOccurrences(haystack, token);
      if (occurrences > 0) {
        matchedDistinct += 1;
        score += occurrences;
      }
    }
    // مكافأة تغطية عدد أكبر من كلمات الاستعلام (تفضيل النتائج الأشمل).
    return score + matchedDistinct * 2;
  }

  private countOccurrences(haystack: string, token: string): number {
    if (!token) {
      return 0;
    }
    let count = 0;
    let idx = haystack.indexOf(token);
    while (idx !== -1) {
      count += 1;
      idx = haystack.indexOf(token, idx + token.length);
    }
    return count;
  }

  /** تطبيع عربي: إزالة التشكيل والتطويل، وتوحيد الألف/الياء/التاء المربوطة، وتصغير وإزالة الرموز. */
  private normalize(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/[ً-ْ]/g, '')
      .replace(/ـ/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

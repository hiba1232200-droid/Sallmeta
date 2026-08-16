import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ValidateInput {
  merchantId: string;
  currency: string;
  reply: string;
  createdOrder?: { total: string } | null;
}

export interface ValidateResult {
  ok: boolean;
  reason?: string;
}

/**
 * خطوة "التحقّق من ردّ الذكاء الاصطناعي" (دفاع في العمق ضد الهلوسة).
 * تتأكد أن أي مبلغ مقترن بعملة يُذكر في الردّ موجود فعلًا ضمن بيانات المتجر
 * (أسعار المنتجات، أرقام الأسئلة الشائعة، إجمالي طلب أُنشئ). إن ظهر سعر غير مؤصَّل
 * يُعتبر الردّ غير صالح فيُستبدل برسالة آمنة (لا نسلّم أسعارًا مخترعة).
 */
@Injectable()
export class AiResponseValidator {
  constructor(private readonly prisma: PrismaService) {}

  async validate(input: ValidateInput): Promise<ValidateResult> {
    const claims = this.extractPriceClaims(input.reply, input.currency);
    if (claims.length === 0) {
      return { ok: true };
    }
    const grounded = await this.groundedPrices(input.merchantId, input.createdOrder);
    for (const claim of claims) {
      const found = [...grounded].some((g) => Math.abs(g - claim) < 0.01);
      if (!found) {
        return { ok: false, reason: `سعر غير مؤصَّل: ${claim}` };
      }
    }
    return { ok: true };
  }

  private async groundedPrices(
    merchantId: string,
    createdOrder?: { total: string } | null,
  ): Promise<Set<number>> {
    const set = new Set<number>();

    const products = await this.prisma.product.findMany({
      where: { merchantId, status: { not: 'ARCHIVED' } },
      select: { price: true, oldPrice: true },
      take: 2000,
    });
    for (const p of products) {
      set.add(this.round(Number(p.price)));
      if (p.oldPrice != null) {
        set.add(this.round(Number(p.oldPrice)));
      }
    }

    const faqs = await this.prisma.faq.findMany({
      where: { merchantId, isActive: true },
      select: { question: true, answer: true },
      take: 300,
    });
    for (const f of faqs) {
      for (const n of this.allNumbers(`${f.question} ${f.answer}`)) {
        set.add(this.round(n));
      }
    }

    if (createdOrder?.total) {
      set.add(this.round(Number(createdOrder.total)));
    }
    return set;
  }

  /** يستخرج الأرقام المقترنة بعملة (أسعار مُدّعاة) من الردّ. */
  private extractPriceClaims(reply: string, currency: string): number[] {
    const text = this.normalizeDigits(reply).toLowerCase();
    const cues = [
      '$',
      '€',
      '£',
      currency.toLowerCase(),
      'دولار',
      'ريال',
      'درهم',
      'دينار',
      'ليرة',
      'جنيه',
      'شيكل',
      'يورو',
    ].filter(Boolean);

    const numberRe = /\d+(?:[.,]\d+)?/g;
    const claims: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = numberRe.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const windowText = text.slice(Math.max(0, start - 8), Math.min(text.length, end + 8));
      if (cues.some((cue) => windowText.includes(cue))) {
        const value = parseFloat(match[0].replace(',', '.'));
        if (!Number.isNaN(value) && value > 0) {
          claims.push(this.round(value));
        }
      }
    }
    return claims;
  }

  private allNumbers(text: string): number[] {
    const normalized = this.normalizeDigits(text);
    const out: number[] = [];
    const re = /\d+(?:[.,]\d+)?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(normalized)) !== null) {
      const v = parseFloat(m[0].replace(',', '.'));
      if (!Number.isNaN(v)) {
        out.push(v);
      }
    }
    return out;
  }

  /** يحوّل الأرقام العربية-الهندية (٠-٩ و ۰-۹) إلى أرقام لاتينية. */
  private normalizeDigits(s: string): string {
    return s
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}

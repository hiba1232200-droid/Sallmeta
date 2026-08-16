import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MerchantsService } from '../merchants/merchants.service';
import { UsageService } from '../subscriptions/usage.service';
import {
  AgentRunInput,
  AgentRunResult,
  AiMessage,
  LlmProvider,
  LLM_PROVIDER,
  ToolContext,
} from './ai.types';
import { buildSystemPrompt } from './prompt';
import { AiResponseValidator } from './ai-response.validator';
import { SalesToolsService } from './tools/sales-tools.service';

/**
 * وكيل مبيعات مؤصَّل: يبني السياق من إعدادات المتجر وبياناته، ثم يدير حلقة
 * استدعاء الأدوات مع المزوّد المختار، مع ضمان عدم اختراع أي معلومة.
 */
@Injectable()
export class SalesAgentService {
  private readonly logger = new Logger(SalesAgentService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly prisma: PrismaService,
    private readonly merchants: MerchantsService,
    private readonly conversations: ConversationsService,
    private readonly tools: SalesToolsService,
    private readonly usage: UsageService,
    private readonly config: ConfigService,
    private readonly validator: AiResponseValidator,
  ) {}

  async process(input: AgentRunInput, options: { meter?: boolean } = {}): Promise<AgentRunResult> {
    const meter = options.meter ?? true;
    const settings = await this.merchants.getAiSettings(input.merchantId);

    if (!settings.enabled) {
      return {
        reply: '',
        disabled: true,
        handoff: false,
        validated: true,
        toolTrace: [],
        createdOrder: null,
      };
    }

    // تحويل للموظف البشري عند مطابقة كلمة مفتاحية
    const keywords = settings.handoffKeywords ?? [];
    if (keywords.some((k) => k && input.userText.includes(k))) {
      return {
        reply: 'سأحوّلك إلى أحد موظفي المتجر لمساعدتك. لحظات من فضلك.',
        disabled: false,
        handoff: true,
        validated: true,
        toolTrace: [],
        createdOrder: null,
      };
    }

    const store = await this.prisma.merchant.findUnique({
      where: { id: input.merchantId },
      select: { name: true, description: true, currency: true, phone: true },
    });
    const storeInfo = {
      name: store?.name ?? 'المتجر',
      description: store?.description,
      currency: store?.currency ?? 'USD',
      phone: store?.phone,
    };
    const system = buildSystemPrompt(settings, storeInfo);

    const allowOrder = input.allowOrderCreationOverride ?? settings.allowOrderCreation;
    const ctx: ToolContext = {
      merchantId: input.merchantId,
      customerId: input.customerId,
      conversationId: input.conversationId,
      currency: storeInfo.currency,
      allowOrderCreation: allowOrder,
      state: {},
    };

    const messages = await this.buildHistory(input);
    const tools = this.tools.getSchemas(allowOrder);
    const maxIterations = this.config.get<number>('ai.maxToolIterations') ?? 5;
    const trace: AgentRunResult['toolTrace'] = [];
    let finalContent = '';

    try {
      const working: AiMessage[] = [...messages];
      for (let i = 0; i < maxIterations; i++) {
        const res = await this.provider.chat({
          system,
          messages: working,
          tools,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
        });

        if (res.toolCalls?.length) {
          working.push({ role: 'assistant', content: res.content ?? '', toolCalls: res.toolCalls });
          for (const call of res.toolCalls) {
            const result = await this.tools.execute(call.name, call.arguments, ctx);
            trace.push({ name: call.name, arguments: call.arguments, result });
            working.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.name,
              content: JSON.stringify(result),
            });
          }
          continue;
        }

        finalContent = (res.content ?? '').trim();
        break;
      }
    } catch (err) {
      this.logger.error(`خطأ في مزوّد الذكاء الاصطناعي: ${(err as Error).message}`);
      finalContent = '';
    }

    if (!finalContent) {
      finalContent = settings.fallbackMessage || 'عذرًا، لا أستطيع المساعدة بهذا الطلب حاليًا.';
    }

    // خطوة التحقّق من الردّ: منع تسليم أي سعر غير مؤصَّل في بيانات المتجر.
    let validated = true;
    try {
      const check = await this.validator.validate({
        merchantId: input.merchantId,
        currency: storeInfo.currency,
        reply: finalContent,
        createdOrder: ctx.state.createdOrder ?? null,
      });
      if (!check.ok) {
        this.logger.warn(`ردّ غير مؤصَّل (${check.reason}) — استُبدل برسالة آمنة`);
        finalContent =
          settings.fallbackMessage ||
          'عذرًا، لا أملك هذه المعلومة بدقّة حاليًا. يرجى التواصل مع فريق المتجر للتأكّد.';
        validated = false;
      }
    } catch {
      // لا نُفشل الردّ بسبب المُحقّق نفسه
    }

    if (meter) {
      await this.usage.increment(input.merchantId, 'AI_MESSAGE').catch(() => undefined);
    }

    return {
      reply: finalContent,
      disabled: false,
      handoff: false,
      validated,
      toolTrace: trace,
      createdOrder: ctx.state.createdOrder ?? null,
    };
  }

  private async buildHistory(input: AgentRunInput): Promise<AiMessage[]> {
    let messages: AiMessage[] = [];
    if (input.conversationId) {
      const recent = await this.conversations.getRecentMessages(input.conversationId, 16);
      messages = recent
        .filter((m) => m.role === 'CUSTOMER' || m.role === 'ASSISTANT' || m.role === 'AGENT')
        .map((m) => ({
          role: m.role === 'CUSTOMER' ? 'user' : 'assistant',
          content: m.content,
        }));
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || last.content !== input.userText) {
      messages.push({ role: 'user', content: input.userText });
    }
    return messages;
  }
}

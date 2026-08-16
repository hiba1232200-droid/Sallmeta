import { AiChatRequest, AiChatResult, LlmProvider } from '../ai.types';

/**
 * مزوّد افتراضي آمن يُستخدم عند AI_PROVIDER=none (لا مفتاح API).
 * لا يخترع أي معلومة: يعيد محتوى فارغًا فيتحوّل الوكيل إلى رسالة fallback.
 * تفعيل مزوّد حقيقي (OpenAI/Anthropic) يُنشّط قدرات المحادثة واستدعاء الأدوات كاملة.
 */
export class NullProvider implements LlmProvider {
  readonly name = 'none';

  async chat(_request: AiChatRequest): Promise<AiChatResult> {
    return { content: null, toolCalls: [], finishReason: 'no_provider' };
  }
}

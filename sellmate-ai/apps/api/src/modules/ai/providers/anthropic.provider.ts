import { AiChatRequest, AiChatResult, AiToolCall, LlmProvider } from '../ai.types';

/**
 * مزوّد Anthropic (Claude Messages API + tool use).
 * التحميل كسول عبر require حتى لا يرتبط بناء المشروع بوجود الحزمة.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly client: any;

  constructor(apiKey: string, private readonly model: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Anthropic = require('@anthropic-ai/sdk');
    const Ctor = Anthropic.default ?? Anthropic;
    this.client = new Ctor({ apiKey });
  }

  async chat(request: AiChatRequest): Promise<AiChatResult> {
    const messages = this.toAnthropicMessages(request);
    const tools = request.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const res = await this.client.messages.create({
      model: this.model,
      system: request.system,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages,
      tools: tools.length ? tools : undefined,
    });

    let text = '';
    const toolCalls: AiToolCall[] = [];
    for (const block of res.content ?? []) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, arguments: block.input ?? {} });
      }
    }

    return {
      content: text || null,
      toolCalls,
      finishReason: res.stop_reason ?? 'stop',
    };
  }

  /** يحوّل رسائلنا المحايدة إلى تنسيق Anthropic ويجمع نتائج الأدوات في رسالة user واحدة. */
  private toAnthropicMessages(request: AiChatRequest): any[] {
    const out: any[] = [];
    for (const m of request.messages) {
      if (m.role === 'user') {
        out.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        if (m.toolCalls?.length) {
          const content: any[] = [];
          if (m.content) {
            content.push({ type: 'text', text: m.content });
          }
          for (const tc of m.toolCalls) {
            content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments ?? {} });
          }
          out.push({ role: 'assistant', content });
        } else {
          out.push({ role: 'assistant', content: m.content });
        }
      } else if (m.role === 'tool') {
        const block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content };
        const last = out[out.length - 1];
        if (last && last.role === 'user' && Array.isArray(last.content)) {
          last.content.push(block);
        } else {
          out.push({ role: 'user', content: [block] });
        }
      }
    }
    return out;
  }
}

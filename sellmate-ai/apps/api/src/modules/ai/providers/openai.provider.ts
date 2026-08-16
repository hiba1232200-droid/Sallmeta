import { AiChatRequest, AiChatResult, AiMessage, AiToolCall, LlmProvider } from '../ai.types';

/**
 * مزوّد OpenAI (chat.completions + function/tool calling).
 * التحميل كسول عبر require حتى لا يرتبط بناء المشروع بوجود الحزمة.
 */
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly client: any;

  constructor(apiKey: string, private readonly model: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    const Ctor = OpenAI.default ?? OpenAI;
    this.client = new Ctor({ apiKey });
  }

  async chat(request: AiChatRequest): Promise<AiChatResult> {
    const messages: any[] = [{ role: 'system', content: request.system }];
    for (const m of request.messages) {
      messages.push(this.toOpenAi(m));
    }

    const tools = request.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? 'auto' : undefined,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    });

    const choice = res.choices?.[0];
    const msg = choice?.message ?? {};
    const toolCalls: AiToolCall[] = (msg.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name,
      arguments: safeJson(tc.function?.arguments),
    }));

    return {
      content: msg.content ?? null,
      toolCalls,
      finishReason: choice?.finish_reason ?? 'stop',
    };
  }

  private toOpenAi(m: AiMessage): any {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || '',
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments ?? {}) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  }
}

function safeJson(value: any): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return {};
  }
}

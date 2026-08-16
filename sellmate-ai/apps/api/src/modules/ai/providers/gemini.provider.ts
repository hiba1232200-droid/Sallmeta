import { AiChatRequest, AiChatResult, AiMessage, AiToolCall, LlmProvider } from '../ai.types';

/**
 * مزوّد Google Gemini (Generative AI + function calling).
 * التحميل كسول عبر require حتى لا يرتبط بناء المشروع بوجود الحزمة.
 */
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly client: any;

  constructor(apiKey: string, private readonly model: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(request: AiChatRequest): Promise<AiChatResult> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: request.system,
      tools: request.tools.length
        ? [
            {
              functionDeclarations: request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
            },
          ]
        : undefined,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      },
    });

    const result = await model.generateContent({
      contents: this.toGeminiContents(request.messages),
    });
    const response = result.response;

    let text = '';
    const toolCalls: AiToolCall[] = [];
    let index = 0;
    for (const part of response?.candidates?.[0]?.content?.parts ?? []) {
      if (part.text) {
        text += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `${part.functionCall.name}_${index++}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        });
      }
    }

    return {
      content: text || null,
      toolCalls,
      finishReason: response?.candidates?.[0]?.finishReason ?? 'stop',
    };
  }

  private toGeminiContents(messages: AiMessage[]): any[] {
    const out: any[] = [];
    for (const m of messages) {
      if (m.role === 'user') {
        out.push({ role: 'user', parts: [{ text: m.content }] });
      } else if (m.role === 'assistant') {
        const parts: any[] = [];
        if (m.content) {
          parts.push({ text: m.content });
        }
        for (const tc of m.toolCalls ?? []) {
          parts.push({ functionCall: { name: tc.name, args: tc.arguments ?? {} } });
        }
        out.push({ role: 'model', parts: parts.length ? parts : [{ text: '' }] });
      } else if (m.role === 'tool') {
        out.push({
          role: 'function',
          parts: [{ functionResponse: { name: m.name ?? 'tool', response: this.asObject(m.content) } }],
        });
      }
    }
    return out;
  }

  private asObject(content: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(content);
      return typeof parsed === 'object' && parsed !== null ? parsed : { result: parsed };
    } catch {
      return { result: content };
    }
  }
}

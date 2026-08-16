/**
 * أنواع محايدة عن المزوّد (provider-agnostic) لطبقة الذكاء الاصطناعي.
 * كل مزوّد (OpenAI / Anthropic / None) يحوّل من/إلى هذه الأنواع.
 */

export type AiRole = 'user' | 'assistant' | 'tool';

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiMessage {
  role: AiRole;
  content: string;
  /** عند role='assistant' مع طلب استدعاء أداة. */
  toolCalls?: AiToolCall[];
  /** عند role='tool': معرّف الاستدعاء الذي تُجيب عليه هذه الرسالة. */
  toolCallId?: string;
  name?: string;
}

export interface AiToolSchema {
  name: string;
  description: string;
  /** JSON Schema لوسائط الأداة. */
  parameters: Record<string, unknown>;
}

export interface AiChatRequest {
  system: string;
  messages: AiMessage[];
  tools: AiToolSchema[];
  temperature: number;
  maxTokens: number;
}

export interface AiChatResult {
  content: string | null;
  toolCalls: AiToolCall[];
  finishReason: string;
}

export interface LlmProvider {
  readonly name: string;
  chat(request: AiChatRequest): Promise<AiChatResult>;
}

export const LLM_PROVIDER = 'LLM_PROVIDER';

export interface ToolContext {
  merchantId: string;
  customerId?: string;
  conversationId?: string;
  currency: string;
  allowOrderCreation: boolean;
  state: {
    createdOrder?: { id: string; number: string; total: string; currency: string };
  };
}

export interface AgentRunInput {
  merchantId: string;
  conversationId?: string;
  customerId?: string;
  userText: string;
  /** يتجاوز إعداد allowOrderCreation (تُستخدم في المعاينة لتعطيل الطلبات). */
  allowOrderCreationOverride?: boolean;
}

export interface AgentRunResult {
  reply: string;
  disabled: boolean;
  handoff: boolean;
  /** نتيجة خطوة التحقّق: false إذا اكتُشف سعر غير مؤصَّل واستُبدل الردّ برسالة آمنة. */
  validated: boolean;
  toolTrace: Array<{ name: string; arguments: unknown; result: unknown }>;
  createdOrder?: { id: string; number: string; total: string; currency: string } | null;
}

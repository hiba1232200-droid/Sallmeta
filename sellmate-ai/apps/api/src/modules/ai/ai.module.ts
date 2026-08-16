import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationsModule } from '../conversations/conversations.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AiController } from './ai.controller';
import { AiResponseValidator } from './ai-response.validator';
import { LlmProvider, LLM_PROVIDER } from './ai.types';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { NullProvider } from './providers/null.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { SalesAgentService } from './sales-agent.service';
import { SalesToolsService } from './tools/sales-tools.service';

/**
 * اختيار مزوّد الذكاء الاصطناعي عبر متغيّر بيئة واحد (AI_PROVIDER) — بلا ربط hard-coded.
 * أضِف مزوّدًا جديدًا بإنشاء صنف يحقّق LlmProvider ثم سطر واحد هنا.
 */
const llmProvider = {
  provide: LLM_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): LlmProvider => {
    const provider = config.get<string>('ai.provider');
    const apiKey = config.get<string>('ai.apiKey') ?? '';
    const modelOverride = config.get<string>('ai.model') || '';

    switch (provider) {
      case 'openai':
        return new OpenAiProvider(apiKey, modelOverride || config.get<string>('ai.openai.model')!);
      case 'anthropic':
        return new AnthropicProvider(
          apiKey,
          modelOverride || config.get<string>('ai.anthropic.model')!,
        );
      case 'gemini':
        return new GeminiProvider(apiKey, modelOverride || config.get<string>('ai.gemini.model')!);
      default:
        return new NullProvider();
    }
  },
};

@Module({
  imports: [
    MerchantsModule,
    ConversationsModule,
    ProductsModule,
    KnowledgeModule,
    OrdersModule,
    SubscriptionsModule,
  ],
  controllers: [AiController],
  providers: [SalesToolsService, SalesAgentService, AiResponseValidator, llmProvider],
  exports: [SalesAgentService],
})
export class AiModule {}

import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, RetrievalService],
  exports: [KnowledgeService, RetrievalService],
})
export class KnowledgeModule {}

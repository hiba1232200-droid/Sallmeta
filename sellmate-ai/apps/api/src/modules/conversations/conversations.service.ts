import { Injectable, NotFoundException } from '@nestjs/common';
import { Conversation, ConversationStatus, Message, MessageRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, skipTake } from '../../common/utils/pagination.util';
import { QueryConversationsDto } from './dto/query-conversations.dto';

interface AddMessageInput {
  merchantId: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  toolName?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** يجلب محادثة القناة (chat) أو ينشئها. */
  async getOrCreate(
    merchantId: string,
    customerId: string,
    externalChatId: string,
  ): Promise<Conversation> {
    return this.prisma.conversation.upsert({
      where: { merchantId_externalChatId: { merchantId, externalChatId } },
      update: { customerId, lastMessageAt: new Date() },
      create: { merchantId, customerId, externalChatId },
    });
  }

  async addMessage(input: AddMessageInput): Promise<Message> {
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          merchantId: input.merchantId,
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          toolName: input.toolName,
          metadata: input.metadata,
        },
      }),
      this.prisma.conversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);
    return message;
  }

  /** آخر رسائل المحادثة مرتّبة تصاعديًا (لبناء سياق الذكاء الاصطناعي). */
  async getRecentMessages(conversationId: string, limit = 20): Promise<Message[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  async findAll(merchantId: string, query: QueryConversationsDto) {
    const { page, limit, status } = query;
    const where: Prisma.ConversationWhereInput = { merchantId, ...(status ? { status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { number: true, status: true },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        ...skipTake(page, limit),
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findOne(merchantId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, merchantId },
      include: {
        customer: true,
        messages: { orderBy: { createdAt: 'asc' }, take: 200 },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, number: true, status: true, total: true, currency: true },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException('المحادثة غير موجودة');
    }
    return conversation;
  }

  async setStatus(merchantId: string, id: string, status: ConversationStatus) {
    const existing = await this.prisma.conversation.findFirst({ where: { id, merchantId } });
    if (!existing) {
      throw new NotFoundException('المحادثة غير موجودة');
    }
    return this.prisma.conversation.update({ where: { id }, data: { status } });
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramBot } from '@prisma/client';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Telegram } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConversationsService } from '../conversations/conversations.service';
import { CustomersService } from '../customers/customers.service';
import { ConfigureBotDto } from './dto/configure-bot.dto';
import { BOT_COMMANDS } from './telegram.constants';
import { BotContext, TelegramDispatcher } from './telegram.dispatcher';

/** مقارنة ثابتة الزمن لسلسلتين (تمنع كشف السرّ عبر قياس زمن المقارنة). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly clients = new Map<string, Telegram>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly customers: CustomersService,
    private readonly conversations: ConversationsService,
    private readonly dispatcher: TelegramDispatcher,
  ) {}

  // ----------------------------- إدارة البوت -----------------------------

  async getConfig(merchantId: string) {
    const bot = await this.prisma.telegramBot.findUnique({ where: { merchantId } });
    if (!bot) {
      return null;
    }
    return {
      botUsername: bot.botUsername,
      ownerChatId: bot.ownerChatId,
      isActive: bot.isActive,
      tokenSet: true,
      lastSetWebhookAt: bot.lastSetWebhookAt,
      webhookUrl: this.webhookUrl(merchantId),
    };
  }

  /** يربط بوت المتجر: يتحقق من الرمز، يخزّنه مشفّرًا، يضبط webhook وقائمة الأوامر. */
  async configure(merchantId: string, dto: ConfigureBotDto) {
    const token = dto.botToken.trim();
    const tg = new Telegram(token);
    let me: { username?: string };
    try {
      me = await tg.getMe();
    } catch {
      throw new BadRequestException('تعذّر التحقق من رمز البوت مع تيليجرام');
    }

    const webhookSecret = randomBytes(24).toString('hex');
    const encryptedToken = this.encryption.encrypt(token);

    await this.prisma.telegramBot.upsert({
      where: { merchantId },
      update: {
        botToken: encryptedToken,
        botUsername: me.username,
        ownerChatId: dto.ownerChatId ?? undefined,
        webhookSecret,
        isActive: true,
      },
      create: {
        merchantId,
        botToken: encryptedToken,
        botUsername: me.username,
        ownerChatId: dto.ownerChatId,
        webhookSecret,
        isActive: true,
      },
    });

    this.clients.delete(merchantId);
    const url = this.webhookUrl(merchantId);
    try {
      await tg.setWebhook(url, { secret_token: webhookSecret, drop_pending_updates: true });
      await tg.setMyCommands(BOT_COMMANDS);
      await this.prisma.telegramBot.update({
        where: { merchantId },
        data: { lastSetWebhookAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(`تعذّر ضبط webhook/الأوامر تلقائيًا: ${(err as Error).message}`);
    }

    return { botUsername: me.username, isActive: true, webhookUrl: url };
  }

  async setActive(merchantId: string, active: boolean) {
    const bot = await this.requireBot(merchantId);
    await this.prisma.telegramBot.update({ where: { merchantId }, data: { isActive: active } });
    const tg = this.clientFor(bot);
    try {
      if (active) {
        await tg.setWebhook(this.webhookUrl(merchantId), { secret_token: bot.webhookSecret });
      } else {
        await tg.deleteWebhook();
      }
    } catch (err) {
      this.logger.warn(`تعذّر تحديث webhook: ${(err as Error).message}`);
    }
    return { isActive: active };
  }

  async remove(merchantId: string) {
    const bot = await this.prisma.telegramBot.findUnique({ where: { merchantId } });
    if (bot) {
      try {
        await this.clientFor(bot).deleteWebhook();
      } catch {
        // تجاهل
      }
      await this.prisma.telegramBot.delete({ where: { merchantId } });
      this.clients.delete(merchantId);
    }
    return { success: true };
  }

  // --------------------------- معالجة الـ webhook ---------------------------

  /**
   * نقطة دخول تحديثات تيليجرام. تتحقق من السرّ، تبني السياق (متجر + عميل + محادثة)،
   * ثم تفوّض المعالجة إلى TelegramDispatcher.
   */
  async handleUpdate(
    merchantId: string,
    secretHeader: string | undefined,
    update: Record<string, any>,
  ): Promise<void> {
    const bot = await this.prisma.telegramBot.findUnique({ where: { merchantId } });
    if (!bot || !bot.isActive) {
      return;
    }
    // مقارنة ثابتة الزمن للسرّ لمنع هجمات التوقيت.
    if (!secretHeader || !safeEqual(secretHeader, bot.webhookSecret)) {
      throw new UnauthorizedException('سرّ webhook غير صحيح');
    }

    // متجر مُعلَّق من مشرف المنصّة: يتوقّف البوت عن الرد (دون حذف بيانات).
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { isActive: true },
    });
    if (!merchant?.isActive) {
      return;
    }

    const tg = this.clientFor(bot);

    if (update.callback_query) {
      const cq = update.callback_query;
      const chat = cq.message?.chat;
      try {
        await tg.answerCbQuery(cq.id);
      } catch {
        // غير حرج
      }
      if (!cq.from || !chat) {
        return;
      }
      const ctx = await this.buildContext(bot, tg, cq.from, chat);
      await this.dispatcher.handleCallback(ctx, String(cq.data ?? ''));
      return;
    }

    const message = update.message;
    if (!message || !message.from || !message.chat || typeof message.text !== 'string') {
      return; // نعالج الرسائل النصية والأزرار فقط في هذه النسخة
    }
    const ctx = await this.buildContext(bot, tg, message.from, message.chat);
    await this.dispatcher.handleText(ctx, message.text);
  }

  private async buildContext(
    bot: TelegramBot,
    tg: Telegram,
    from: any,
    chat: any,
  ): Promise<BotContext> {
    const chatId = String(chat.id);
    const isOwner = !!bot.ownerChatId && String(bot.ownerChatId) === chatId;
    const customer = await this.customers.upsertFromTelegram(bot.merchantId, {
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code,
    });
    const conversation = await this.conversations.getOrCreate(bot.merchantId, customer.id, chatId);
    return {
      tg,
      bot,
      merchantId: bot.merchantId,
      chatId,
      isOwner,
      customer,
      conversationId: conversation.id,
      conversationStatus: conversation.status,
    };
  }

  /** يرسل ردّ صاحب المتجر إلى العميل عبر البوت ويسجّله كرسالة AGENT (Take Over). */
  async sendAgentReply(merchantId: string, conversationId: string, message: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, merchantId },
    });
    if (!conversation) {
      throw new NotFoundException('المحادثة غير موجودة');
    }
    const bot = await this.prisma.telegramBot.findUnique({ where: { merchantId } });
    if (!bot) {
      throw new BadRequestException('لم يتم ربط بوت تيليجرام لهذا المتجر');
    }
    const tg = this.clientFor(bot);
    await tg.sendMessage(conversation.externalChatId, message);
    await this.conversations.addMessage({
      merchantId,
      conversationId,
      role: 'AGENT',
      content: message,
    });
    await this.conversations
      .setStatus(merchantId, conversationId, 'HUMAN_ACTIVE')
      .catch(() => undefined);
    return { success: true };
  }

  // ------------------------------- مساعدات -------------------------------

  private clientFor(bot: TelegramBot): Telegram {
    let client = this.clients.get(bot.merchantId);
    if (!client) {
      client = new Telegram(this.encryption.decrypt(bot.botToken));
      this.clients.set(bot.merchantId, client);
    }
    return client;
  }

  private async requireBot(merchantId: string): Promise<TelegramBot> {
    const bot = await this.prisma.telegramBot.findUnique({ where: { merchantId } });
    if (!bot) {
      throw new NotFoundException('لم يتم ربط بوت تيليجرام لهذا المتجر');
    }
    return bot;
  }

  private webhookUrl(merchantId: string): string {
    const base = this.config.get<string>('telegram.webhookBaseUrl') ?? 'http://localhost:4000';
    return `${base}/api/v1/telegram/webhook/${merchantId}`;
  }
}

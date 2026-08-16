import { Injectable, Logger } from '@nestjs/common';
import { Telegram } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';

/**
 * مُرسِل تيليجرام خفيف للإشعارات — يعتمد فقط على Prisma وخدمة التشفير،
 * فلا يستورد وحدة تيليجرام الكاملة (تجنّبًا لأي تبعية دائرية مع Orders/Customers).
 * كل الإرسال «أفضل جهد»: أي فشل لا يُعطّل العملية الأساسية.
 */
@Injectable()
export class TelegramNotifier {
  private readonly logger = new Logger(TelegramNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /** يرسل رسالة إلى دردشة محددة (عميل أو غيره) عبر بوت المتجر. */
  async send(merchantId: string, chatId: string, text: string): Promise<void> {
    await this.deliver(merchantId, chatId, text);
  }

  /** يرسل رسالة إلى صاحب المتجر (ownerChatId المضبوط في إعداد البوت). */
  async sendToOwner(merchantId: string, text: string): Promise<void> {
    try {
      const bot = await this.prisma.telegramBot.findUnique({ where: { merchantId } });
      if (!bot || !bot.isActive || !bot.ownerChatId) {
        return;
      }
      await new Telegram(this.encryption.decrypt(bot.botToken)).sendMessage(bot.ownerChatId, text);
    } catch (err) {
      this.logger.warn(`تعذّر إشعار المالك: ${(err as Error).message}`);
    }
  }

  private async deliver(merchantId: string, chatId: string, text: string): Promise<void> {
    try {
      const bot = await this.prisma.telegramBot.findUnique({ where: { merchantId } });
      if (!bot || !bot.isActive) {
        return;
      }
      await new Telegram(this.encryption.decrypt(bot.botToken)).sendMessage(chatId, text);
    } catch (err) {
      this.logger.warn(`تعذّر إرسال إشعار تيليجرام: ${(err as Error).message}`);
    }
  }
}

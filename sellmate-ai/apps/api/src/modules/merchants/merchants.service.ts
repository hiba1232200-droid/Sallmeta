import { Injectable, NotFoundException } from '@nestjs/common';
import { AiSettings } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        description: true,
        currency: true,
        locale: true,
        timezone: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!merchant) {
      throw new NotFoundException('المتجر غير موجود');
    }
    return merchant;
  }

  async updateProfile(merchantId: string, dto: UpdateMerchantDto) {
    await this.prisma.merchant.update({ where: { id: merchantId }, data: dto });
    return this.getProfile(merchantId);
  }

  /** يجلب إعدادات الذكاء الاصطناعي، وينشئ افتراضية إن لم توجد. */
  async getAiSettings(merchantId: string): Promise<AiSettings> {
    const settings = await this.prisma.aiSettings.findUnique({ where: { merchantId } });
    if (settings) {
      return settings;
    }
    return this.prisma.aiSettings.create({ data: { merchantId } });
  }

  async updateAiSettings(merchantId: string, dto: UpdateAiSettingsDto): Promise<AiSettings> {
    await this.getAiSettings(merchantId); // يضمن وجود السجل
    return this.prisma.aiSettings.update({ where: { merchantId }, data: dto });
  }

  /** حذف المتجر بالكامل (OWNER فقط) — يحذف كل بياناته تتالِيًا. */
  async deleteStore(merchantId: string) {
    await this.prisma.merchant.delete({ where: { id: merchantId } });
    return { success: true };
  }
}

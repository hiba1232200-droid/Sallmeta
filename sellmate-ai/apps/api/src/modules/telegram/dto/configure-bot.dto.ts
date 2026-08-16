import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ConfigureBotDto {
  /** رمز البوت من BotFather بصيغة: 123456789:ABCdef... */
  @IsString()
  @Matches(/^\d+:[A-Za-z0-9_-]+$/, { message: 'صيغة رمز البوت غير صحيحة' })
  botToken!: string;

  /** معرّف محادثة المالك لاستقبال إشعارات الطلبات (اختياري). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerChatId?: string;
}

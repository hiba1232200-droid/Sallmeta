import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

/**
 * تشفير متماثل (AES-256-GCM) لأسرار المتاجر at-rest مثل رموز بوتات تيليجرام.
 * عند غياب ENCRYPTION_KEY يعمل في وضع passthrough (نص عادي) مع تحذير — للتطوير فقط.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const raw = config.get<string>('security.encryptionKey') || '';
    if (raw) {
      this.key = Buffer.from(raw, 'base64');
    } else {
      this.key = null;
      this.logger.warn(
        'ENCRYPTION_KEY غير مضبوط — سيتم تخزين أسرار المتاجر كنص عادي. اضبطه في الإنتاج.',
      );
    }
  }

  encrypt(plain: string): string {
    if (!this.key) {
      return plain;
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(value: string): string {
    if (!value.startsWith(PREFIX)) {
      return value; // نص عادي (توافق خلفي / وضع التطوير)
    }
    if (!this.key) {
      throw new Error('قيمة مشفّرة موجودة لكن ENCRYPTION_KEY غير مضبوط');
    }
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

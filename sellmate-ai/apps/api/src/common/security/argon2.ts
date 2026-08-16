import { Algorithm } from '@node-rs/argon2';

/**
 * إعدادات argon2id مضبوطة وفق توصيات OWASP (m=19MiB, t=2, p=1).
 * تُستخدم لكل عمليات تجزئة كلمات المرور لضمان تماثل التكلفة عبر التطبيق.
 */
export const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

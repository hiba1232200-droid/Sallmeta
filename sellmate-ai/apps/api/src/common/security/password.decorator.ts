import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * قاعدة موحّدة لقوة كلمة المرور: 8–128 حرفًا، وتحتوي على حرف ورقم على الأقل.
 * تُطبّق عبر كل نقاط إنشاء الحسابات لضمان اتساق السياسة.
 */
export function IsStrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(8, { message: 'كلمة المرور يجب ألا تقل عن 8 أحرف' }),
    MaxLength(128, { message: 'كلمة المرور طويلة جدًا (128 حرفًا كحد أقصى)' }),
    Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
      message: 'كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل',
    }),
  );
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../interfaces';

/** يحقن معرّف المتجر (المستأجر) الخاص بالمستخدم الحالي. أساس عزل البيانات. */
export const CurrentMerchantId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user: AuthUser | undefined = request.user;
  return user?.merchantId;
});

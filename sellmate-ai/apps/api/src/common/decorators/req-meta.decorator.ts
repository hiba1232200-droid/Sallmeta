import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** بيانات الطلب المفيدة للتدقيق (IP + User-Agent). متوافقة بنيويًا مع RequestMeta. */
export interface ReqMetaValue {
  ip?: string;
  userAgent?: string;
}

/** يحقن {ip, userAgent} من الطلب لتسجيل التدقيق دون تكرار في كل دالة. */
export const ReqMeta = createParamDecorator((_data: unknown, ctx: ExecutionContext): ReqMetaValue => {
  const req = ctx.switchToHttp().getRequest();
  return { ip: req.ip, userAgent: req.headers?.['user-agent'] };
});

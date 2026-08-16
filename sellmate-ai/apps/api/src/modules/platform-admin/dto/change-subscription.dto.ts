import { IsEnum, IsOptional } from 'class-validator';
import { PlanTier, SubscriptionStatus } from '@prisma/client';

/** تغيير اشتراك متجر من لوحة المشرف: الخطة و/أو الحالة. */
export class AdminChangeSubscriptionDto {
  @IsOptional()
  @IsEnum(PlanTier)
  tier?: PlanTier;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}

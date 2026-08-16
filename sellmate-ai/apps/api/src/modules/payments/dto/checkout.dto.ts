import { PlanTier } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CheckoutDto {
  @IsEnum(PlanTier)
  tier!: PlanTier;
}

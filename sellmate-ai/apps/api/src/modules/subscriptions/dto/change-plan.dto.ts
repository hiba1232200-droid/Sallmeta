import { PlanTier } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangePlanDto {
  @IsEnum(PlanTier)
  tier!: PlanTier;
}

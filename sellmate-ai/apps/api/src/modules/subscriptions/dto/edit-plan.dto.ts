import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  Min,
} from 'class-validator';

/**
 * تعديل خطة على مستوى المنصّة: السعر/الحدود/الميزات/التفعيل.
 * الحدود: -1 تعني غير محدود.
 */
export class EditPlanDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  @IsInt()
  @Min(-1)
  monthlyMessageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(-1)
  productLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(-1)
  staffLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;
}

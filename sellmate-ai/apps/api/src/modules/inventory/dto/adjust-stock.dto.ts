import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, NotEquals } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class AdjustStockDto {
  @IsString()
  productId!: string;

  /** موجب = إضافة للمخزون، سالب = خصم منه. */
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  quantity!: number;

  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

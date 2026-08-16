import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { OrderStatus, SubscriptionStatus } from '@prisma/client';

/** استعلام قائمة عام: ترقيم بالمؤشّر + بحث. */
export class AdminListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cursor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class AdminOrdersDto extends AdminListDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class AdminSubscriptionsDto extends AdminListDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}

export class AdminAuditDto extends AdminListDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  merchantId?: string;
}

export class AdminPaymentsDto extends AdminListDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}

export class AiUsageDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'صيغة الفترة يجب أن تكون YYYY-MM' })
  period?: string;
}

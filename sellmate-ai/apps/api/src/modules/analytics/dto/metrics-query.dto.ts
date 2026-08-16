import { IsIn, IsOptional } from 'class-validator';
import type { AnalyticsRange } from '../analytics.service';

/** نطاق التحليلات: اليوم، ٧ أيام، ٣٠ يومًا، كل الوقت. */
export class MetricsQueryDto {
  @IsOptional()
  @IsIn(['today', '7d', '30d', 'all'])
  range: AnalyticsRange = '30d';
}

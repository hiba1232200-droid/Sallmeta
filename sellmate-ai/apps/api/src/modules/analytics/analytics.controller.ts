import { Controller, Get, Query } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { AnalyticsService } from './analytics.service';
import { SalesQueryDto } from './dto/sales-query.dto';
import { MetricsQueryDto } from './dto/metrics-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentMerchantId() merchantId: string) {
    return this.analytics.getOverview(merchantId);
  }

  @Get('series')
  series(@CurrentMerchantId() merchantId: string, @Query() query: SalesQueryDto) {
    return this.analytics.getSeries(merchantId, query.days);
  }

  /** محرّك التحليلات — كل المؤشّرات لنطاق زمني (today | 7d | 30d | all). */
  @Get('metrics')
  metrics(@CurrentMerchantId() merchantId: string, @Query() query: MetricsQueryDto) {
    return this.analytics.getMetrics(merchantId, query.range);
  }
}

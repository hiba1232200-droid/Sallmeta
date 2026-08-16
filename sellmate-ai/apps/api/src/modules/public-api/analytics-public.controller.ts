import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { AnalyticsService } from '../analytics/analytics.service';

/** واجهة REST العامة للتحليلات — /api/analytics (نظرة عامة شاملة). */
@Controller({ path: 'analytics', version: VERSION_NEUTRAL })
export class AnalyticsPublicController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  overview(@CurrentMerchantId() merchantId: string) {
    return this.analytics.getOverview(merchantId);
  }
}

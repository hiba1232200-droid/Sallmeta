import { Body, Controller, Get, Post, VERSION_NEUTRAL } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutDto } from '../payments/dto/checkout.dto';

/** واجهة REST العامة للاشتراك — /api/subscription. */
@Controller({ path: 'subscription', version: VERSION_NEUTRAL })
export class SubscriptionPublicController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  async current(@CurrentMerchantId() merchantId: string) {
    const { subscription, plan } = await this.subscriptions.getForMerchant(merchantId);
    return this.subscriptions.toPublic(subscription, plan);
  }

  @Post('checkout')
  @Roles('OWNER')
  checkout(@CurrentMerchantId() merchantId: string, @Body() dto: CheckoutDto) {
    return this.payments.createSubscriptionCheckout(merchantId, dto.tier);
  }

  @Post('cancel')
  @Roles('OWNER')
  async cancel(@CurrentMerchantId() merchantId: string) {
    const { subscription, plan } = await this.subscriptions.cancel(merchantId);
    return this.subscriptions.toPublic(subscription, plan);
  }
}

import { Body, Controller, Headers, Post, Req, RawBodyRequest } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** إنشاء جلسة دفع اشتراك (يرجع رابط الدفع). */
  @Post('checkout')
  @Roles('OWNER')
  checkout(@CurrentMerchantId() merchantId: string, @Body() dto: CheckoutDto) {
    return this.payments.createSubscriptionCheckout(merchantId, dto.tier);
  }

  /** webhook المزوّد — يتطلب الجسم الخام (raw body) للتحقّق من التوقيع. */
  @Public()
  @SkipThrottle()
  @Post('webhook')
  webhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const payload = req.rawBody ?? JSON.stringify(req.body);
    return this.payments.handleWebhook(payload, signature);
  }
}

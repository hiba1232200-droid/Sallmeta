import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta, ReqMetaValue } from '../../common/decorators/req-meta.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.constants';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { UsageService } from './usage.service';
import { ChangePlanDto } from './dto/change-plan.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly plans: PlansService,
    private readonly usage: UsageService,
    private readonly audit: AuditService,
  ) {}

  @Get('plans')
  listPlans() {
    return this.plans.list();
  }

  @Get('me')
  async mine(@CurrentMerchantId() merchantId: string) {
    const { subscription, plan } = await this.subscriptions.getForMerchant(merchantId);
    return this.subscriptions.toPublic(subscription, plan);
  }

  @Get('usage')
  usageStats(@CurrentMerchantId() merchantId: string) {
    return this.usage.getMonthlyUsage(merchantId);
  }

  @Post('change')
  @Roles('OWNER')
  async change(
    @CurrentMerchantId() merchantId: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: ChangePlanDto,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const { subscription, plan } = await this.subscriptions.changePlan(merchantId, dto.tier);
    await this.audit.record({
      action: AuditAction.SUBSCRIPTION_CHANGE,
      merchantId,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Subscription',
      targetId: merchantId,
      metadata: { tier: dto.tier },
      ...rm,
    });
    return this.subscriptions.toPublic(subscription, plan);
  }
}

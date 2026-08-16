import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta, ReqMetaValue } from '../../common/decorators/req-meta.decorator';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { AuthUser } from '../../common/interfaces';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.constants';
import { PlatformAdminService } from './platform-admin.service';
import {
  AdminAuditDto,
  AdminListDto,
  AdminOrdersDto,
  AdminPaymentsDto,
  AdminSubscriptionsDto,
  AiUsageDto,
} from './dto/admin-query.dto';
import { AdminChangeSubscriptionDto } from './dto/change-subscription.dto';

/**
 * لوحة المشرف الأعلى (Super Admin) — عابرة لكل المتاجر.
 * محميّة بالكامل بـ PlatformAdminGuard (بريد ضمن PLATFORM_ADMIN_EMAILS) فوق حارس JWT العام.
 */
@Controller('admin')
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController {
  constructor(
    private readonly admin: PlatformAdminService,
    private readonly audit: AuditService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('health')
  health() {
    return this.admin.health();
  }

  // --------------------------------- المستخدمون ---------------------------------

  @Get('users')
  users(@Query() query: AdminListDto) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id/suspend')
  async suspendUser(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const result = await this.admin.setUserActive(id, false);
    await this.audit.record({
      action: AuditAction.ADMIN_USER_SUSPEND,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'User',
      targetId: id,
      ...rm,
    });
    return result;
  }

  @Patch('users/:id/activate')
  async activateUser(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const result = await this.admin.setUserActive(id, true);
    await this.audit.record({
      action: AuditAction.ADMIN_USER_ACTIVATE,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'User',
      targetId: id,
      ...rm,
    });
    return result;
  }

  // ---------------------------------- المتاجر ----------------------------------

  @Get('stores')
  stores(@Query() query: AdminListDto) {
    return this.admin.listStores(query);
  }

  @Patch('stores/:id/suspend')
  async suspendStore(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const result = await this.admin.setStoreActive(id, false);
    await this.audit.record({
      action: AuditAction.ADMIN_STORE_SUSPEND,
      merchantId: id,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Store',
      targetId: id,
      ...rm,
    });
    return result;
  }

  @Patch('stores/:id/activate')
  async activateStore(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const result = await this.admin.setStoreActive(id, true);
    await this.audit.record({
      action: AuditAction.ADMIN_STORE_ACTIVATE,
      merchantId: id,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Store',
      targetId: id,
      ...rm,
    });
    return result;
  }

  // -------------------------------- الاشتراكات --------------------------------

  @Get('subscriptions')
  subscriptions(@Query() query: AdminSubscriptionsDto) {
    return this.admin.listSubscriptions(query);
  }

  @Patch('subscriptions/:merchantId')
  async changeSubscription(
    @Param('merchantId') merchantId: string,
    @Body() dto: AdminChangeSubscriptionDto,
    @CurrentUser() actor: AuthUser,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const result = await this.admin.changeSubscription(merchantId, dto);
    await this.audit.record({
      action: AuditAction.ADMIN_SUBSCRIPTION_CHANGE,
      merchantId,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Subscription',
      targetId: merchantId,
      metadata: { tier: dto.tier, status: dto.status },
      ...rm,
    });
    return result;
  }

  // ------------------------------ مدفوعات/طلبات/استخدام ------------------------------

  @Get('payments')
  payments(@Query() query: AdminPaymentsDto) {
    return this.admin.listPayments(query);
  }

  @Get('orders')
  orders(@Query() query: AdminOrdersDto) {
    return this.admin.listOrders(query);
  }

  @Get('ai-usage')
  aiUsage(@Query() query: AiUsageDto) {
    return this.admin.aiUsage(query.period);
  }

  // ---------------------------------- السجلّات ----------------------------------

  @Get('audit-logs')
  auditLogs(@Query() query: AdminAuditDto) {
    return this.admin.listAuditLogs(query);
  }

  @Get('errors')
  errors(@Query() query: AdminListDto) {
    return this.admin.listErrors(query);
  }

  @Get('reports')
  reports() {
    return this.admin.reports();
  }
}

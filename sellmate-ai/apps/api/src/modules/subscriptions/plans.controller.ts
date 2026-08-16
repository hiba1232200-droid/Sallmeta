import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { PlanTier } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta, ReqMetaValue } from '../../common/decorators/req-meta.decorator';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { AuthUser } from '../../common/interfaces';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.constants';
import { PlansService } from './plans.service';
import { EditPlanDto } from './dto/edit-plan.dto';

/**
 * إدارة الخطط على مستوى المنصّة (SellMate) — لمشرفي المنصّة فقط.
 * تُتيح تعديل الأسعار/الحدود/الميزات من لوحة التحكم.
 */
@Controller('admin/plans')
@UseGuards(PlatformAdminGuard)
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.plans.list();
  }

  @Patch(':tier')
  async edit(
    @Param('tier', new ParseEnumPipe(PlanTier)) tier: PlanTier,
    @Body() dto: EditPlanDto,
    @CurrentUser() actor: AuthUser,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const updated = await this.plans.editPlan(tier, dto);
    await this.audit.record({
      action: AuditAction.PLAN_EDIT,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Plan',
      targetId: tier,
      metadata: { ...dto },
      ...rm,
    });
    return updated;
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta, ReqMetaValue } from '../../common/decorators/req-meta.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.constants';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** إدارة فريق المتجر — لصاحب المتجر والمدير فقط (STAFF ممنوع). */
@Controller('users')
@Roles('OWNER', 'ADMIN')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string) {
    return this.users.list(merchantId);
  }

  @Post()
  async create(
    @CurrentMerchantId() merchantId: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateUserDto,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const created = await this.users.create(merchantId, actor.role, dto);
    await this.audit.record({
      action: AuditAction.USER_CREATE,
      merchantId,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'User',
      targetId: created.id,
      metadata: { email: created.email, role: created.role },
      ...rm,
    });
    return created;
  }

  @Patch(':id')
  async update(
    @CurrentMerchantId() merchantId: string,
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const updated = await this.users.update(merchantId, actor.role, id, dto);
    await this.audit.record({
      action: AuditAction.USER_UPDATE,
      merchantId,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'User',
      targetId: id,
      metadata: { role: dto.role, isActive: dto.isActive },
      ...rm,
    });
    return updated;
  }

  @Delete(':id')
  async remove(
    @CurrentMerchantId() merchantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    const result = await this.users.deactivate(merchantId, user.role, user.userId, id);
    await this.audit.record({
      action: AuditAction.USER_DEACTIVATE,
      merchantId,
      actorId: user.userId,
      actorEmail: user.email,
      targetType: 'User',
      targetId: id,
      ...rm,
    });
    return result;
  }
}

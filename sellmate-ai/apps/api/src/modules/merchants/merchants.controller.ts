import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta, ReqMetaValue } from '../../common/decorators/req-meta.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.constants';
import { MerchantsService } from './merchants.service';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';

@Controller('store')
export class MerchantsController {
  constructor(
    private readonly merchants: MerchantsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  getProfile(@CurrentMerchantId() merchantId: string) {
    return this.merchants.getProfile(merchantId);
  }

  @Patch()
  @Roles('OWNER', 'ADMIN')
  updateProfile(@CurrentMerchantId() merchantId: string, @Body() dto: UpdateMerchantDto) {
    return this.merchants.updateProfile(merchantId, dto);
  }

  @Get('ai-settings')
  getAiSettings(@CurrentMerchantId() merchantId: string) {
    return this.merchants.getAiSettings(merchantId);
  }

  @Patch('ai-settings')
  @Roles('OWNER', 'ADMIN')
  updateAiSettings(@CurrentMerchantId() merchantId: string, @Body() dto: UpdateAiSettingsDto) {
    return this.merchants.updateAiSettings(merchantId, dto);
  }

  /** حذف المتجر نهائيًا — لصاحب المتجر فقط. */
  @Delete()
  @Roles('OWNER')
  async deleteStore(
    @CurrentMerchantId() merchantId: string,
    @CurrentUser() actor: AuthUser,
    @ReqMeta() rm: ReqMetaValue,
  ) {
    // نسجّل الحدث قبل الحذف لضمان بقاء الأثر (سجلّ التدقيق لا يرتبط بالمتجر بمفتاح خارجي).
    await this.audit.record({
      action: AuditAction.STORE_DELETE,
      merchantId,
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'Store',
      targetId: merchantId,
      ...rm,
    });
    return this.merchants.deleteStore(merchantId);
  }
}

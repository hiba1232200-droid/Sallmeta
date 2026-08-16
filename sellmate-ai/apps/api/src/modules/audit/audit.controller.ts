import { Controller, Get, Query } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';

/** قراءة سجلّ التدقيق — مقصور على المالك والمشرف، ومحصور بنطاق المتجر. */
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('OWNER', 'ADMIN')
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryAuditDto) {
    return this.audit.list(merchantId, {
      limit: query.limit ?? 50,
      cursor: query.cursor,
      action: query.action,
    });
  }
}

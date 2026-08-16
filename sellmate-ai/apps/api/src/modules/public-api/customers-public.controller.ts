import { Controller, Get, Param, Query, VERSION_NEUTRAL } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { CustomersService } from '../customers/customers.service';
import { QueryCustomersDto } from '../customers/dto/query-customers.dto';

/** واجهة REST العامة للعملاء — /api/customers (قراءة فقط). */
@Controller({ path: 'customers', version: VERSION_NEUTRAL })
export class CustomersPublicController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryCustomersDto) {
    return this.customers.findAll(merchantId, query);
  }

  @Get(':id')
  findOne(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.customers.findOne(merchantId, id);
  }
}

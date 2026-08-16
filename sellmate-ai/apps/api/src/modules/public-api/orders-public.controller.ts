import { Body, Controller, Get, Param, Post, Put, Query, VERSION_NEUTRAL } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { UpdateOrderStatusDto } from '../orders/dto/update-order-status.dto';
import { QueryOrdersDto } from '../orders/dto/query-orders.dto';

/** واجهة REST العامة للطلبات — /api/orders. */
@Controller({ path: 'orders', version: VERSION_NEUTRAL })
export class OrdersPublicController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryOrdersDto) {
    return this.orders.findAll(merchantId, query);
  }

  @Get(':id')
  findOne(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.orders.findOne(merchantId, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'STAFF')
  create(@CurrentMerchantId() merchantId: string, @Body() dto: CreateOrderDto) {
    return this.orders.createFromDashboard(merchantId, dto);
  }

  /** تحديث الطلب — الحقل المدعوم حاليًا: الحالة (status). */
  @Put(':id')
  @Roles('OWNER', 'ADMIN', 'STAFF')
  update(
    @CurrentMerchantId() merchantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(merchantId, id, dto.status);
  }
}

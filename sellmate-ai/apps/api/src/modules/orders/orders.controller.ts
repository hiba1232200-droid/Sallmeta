import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryOrdersDto) {
    return this.orders.findAll(merchantId, query);
  }

  @Post()
  create(@CurrentMerchantId() merchantId: string, @Body() dto: CreateOrderDto) {
    return this.orders.createFromDashboard(merchantId, dto);
  }

  @Get(':id')
  findOne(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.orders.findOne(merchantId, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentMerchantId() merchantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(merchantId, id, dto.status);
  }
}

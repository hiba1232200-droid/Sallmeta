import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post('adjust')
  adjust(
    @CurrentMerchantId() merchantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventory.adjustStock(merchantId, dto, userId);
  }

  @Get('movements')
  movements(@CurrentMerchantId() merchantId: string, @Query() query: QueryMovementsDto) {
    return this.inventory.listMovements(merchantId, query);
  }
}

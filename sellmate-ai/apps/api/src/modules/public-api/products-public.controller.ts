import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProductsService } from '../products/products.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { QueryProductsDto } from '../products/dto/query-products.dto';

/** واجهة REST العامة للمنتجات — /api/products. */
@Controller({ path: 'products', version: VERSION_NEUTRAL })
export class ProductsPublicController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryProductsDto) {
    return this.products.findAll(merchantId, query);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'STAFF')
  create(@CurrentMerchantId() merchantId: string, @Body() dto: CreateProductDto) {
    return this.products.create(merchantId, dto);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN', 'STAFF')
  update(
    @CurrentMerchantId() merchantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(merchantId, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN', 'STAFF')
  remove(
    @CurrentMerchantId() merchantId: string,
    @Param('id') id: string,
    @Query('permanent') permanent?: string,
  ) {
    return this.products.remove(merchantId, id, permanent === 'true');
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { QueryFaqsDto } from './dto/query-faqs.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryFaqsDto) {
    return this.faqs.findAll(merchantId, query);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@CurrentMerchantId() merchantId: string, @Body() dto: CreateFaqDto) {
    return this.faqs.create(merchantId, dto);
  }

  @Get(':id')
  findOne(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.faqs.findOne(merchantId, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(
    @CurrentMerchantId() merchantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFaqDto,
  ) {
    return this.faqs.update(merchantId, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  remove(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.faqs.remove(merchantId, id);
  }
}

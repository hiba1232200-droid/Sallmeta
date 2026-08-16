import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { ImportUrlDto } from './dto/import-url.dto';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryKnowledgeDto) {
    return this.knowledge.findAll(merchantId, query);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@CurrentMerchantId() merchantId: string, @Body() dto: CreateKnowledgeDto) {
    return this.knowledge.create(merchantId, dto);
  }

  /** استيراد محتوى صفحة ويب (رابط موقع التاجر) إلى قاعدة المعرفة. */
  @Post('import-url')
  @Roles('OWNER', 'ADMIN')
  importUrl(@CurrentMerchantId() merchantId: string, @Body() dto: ImportUrlDto) {
    return this.knowledge.importUrl(merchantId, dto.url, dto.category);
  }

  @Get(':id')
  findOne(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.knowledge.findOne(merchantId, id);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN')
  replace(
    @CurrentMerchantId() merchantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDto,
  ) {
    return this.knowledge.update(merchantId, id, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(
    @CurrentMerchantId() merchantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDto,
  ) {
    return this.knowledge.update(merchantId, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  remove(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.knowledge.remove(merchantId, id);
  }
}

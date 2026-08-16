import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { diskStorage } from 'multer';
import { CurrentMerchantId } from '../../common/decorators/current-merchant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  MAX_UPLOAD_BYTES,
  UPLOADS_DIR,
  extensionForMime,
  isAllowedImageMime,
  sniffImageType,
} from '../../common/uploads';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@CurrentMerchantId() merchantId: string, @Query() query: QueryProductsDto) {
    return this.products.findAll(merchantId, query);
  }

  @Get('categories')
  categories(@CurrentMerchantId() merchantId: string) {
    return this.products.listCategories(merchantId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'STAFF')
  create(@CurrentMerchantId() merchantId: string, @Body() dto: CreateProductDto) {
    return this.products.create(merchantId, dto);
  }

  /** رفع صورة منتج (multipart/form-data، حقل "file") — يعيد رابط الصورة. */
  @Post('upload')
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        // الامتداد يُشتقّ من النوع المُتحقَّق منه فقط (لا من اسم الملف الأصلي — منعًا لـ .svg/.html).
        filename: (_req, file, cb) =>
          cb(
            null,
            `${Date.now()}-${randomBytes(8).toString('hex')}${extensionForMime(file.mimetype)}`,
          ),
      }),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        // تحقق مبدئي من الترويسة؛ التحقق الحاسم بالبصمة الثنائية يجري بعد الكتابة.
        if (isAllowedImageMime(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('نوع الملف غير مدعوم (PNG/JPEG/WEBP/GIF فقط)'));
        }
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('لم يُرفع أي ملف');
    }
    // تحقق حاسم: البصمة الثنائية الفعلية على القرص يجب أن تطابق صورة نقطية مسموحة.
    const stored = join(UPLOADS_DIR, file.filename);
    const detected = sniffImageType(stored);
    if (!detected) {
      try {
        unlinkSync(stored);
      } catch {
        /* الملف قد يكون حُذف مسبقًا */
      }
      throw new BadRequestException('محتوى الملف ليس صورة صالحة');
    }
    const base = this.config.get<string>('app.apiUrl') ?? 'http://localhost:4000';
    return { url: `${base}/uploads/${file.filename}`, filename: file.filename };
  }

  @Get(':id')
  findOne(@CurrentMerchantId() merchantId: string, @Param('id') id: string) {
    return this.products.findOne(merchantId, id);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN', 'STAFF')
  replace(
    @CurrentMerchantId() merchantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(merchantId, id, dto);
  }

  @Patch(':id')
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

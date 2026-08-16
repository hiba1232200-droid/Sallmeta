import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { RefreshDto } from '../auth/dto/refresh.dto';

/** واجهة REST العامة للمصادقة — /api/auth (بلا نسخة). */
@Controller({ path: 'auth', version: VERSION_NEUTRAL })
export class AuthPublicController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.auth.register(dto, { ip, userAgent: ua });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.auth.login(dto, { ip, userAgent: ua });
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Body() dto: RefreshDto, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.auth.logout(dto.refreshToken, { ip, userAgent: ua });
  }
}

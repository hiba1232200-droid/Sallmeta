import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { RequestMeta } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.auth.register(dto, meta(ip, ua));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.auth.login(dto, meta(ip, ua));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Body() dto: RefreshDto, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.auth.logout(dto.refreshToken, meta(ip, ua));
  }

  @Get('me')
  me(@CurrentUser('userId') userId: string) {
    return this.auth.getMe(userId);
  }
}

/** يبني بيانات الطلب (IP + User-Agent) لتسجيل التدقيق. */
function meta(ip?: string, ua?: string): RequestMeta {
  return { ip, userAgent: ua };
}

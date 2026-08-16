import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, JwtPayload } from '../../../common/interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('نوع الرمز غير صالح');
    }
    return {
      userId: payload.sub,
      merchantId: payload.merchantId,
      role: payload.role,
      email: payload.email,
    };
  }
}

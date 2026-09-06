import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { MoinConfigService } from '../config/config.service';
import { JwtPayload, RefreshTokenData, TokenType } from './jwt.interface';
import { Request } from 'express';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh', // AuthGuard('jwt-refresh')에서 사용될 전략 이름
) {
  constructor(private configService: MoinConfigService) {
    const jwtConfig = configService.getJwtConfig();
    super({
      // [핵심] 요청의 Body나 Header가 아닌 '쿠키'에서 토큰을 추출합니다.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => {
          return req.cookies?.refreshToken;
        },
      ]),
      ignoreExpiration: false, // 만료된 토큰은 거부 (401 에러)
      secretOrKey: jwtConfig.JWT_REFRESH_SECRET, // 서명 검증을 위한 비밀키
      passReqToCallback: true, // validate()에서 req 객체를 직접 쓰기 위해 true 설정
    });
  }

  /**
   * [토큰 검증 로직]
   * super()에서 서명 유효성 검사가 끝난 후 실행됩니다.
   * 여기서 반환된 값은 request.user에 저장됩니다.
   */
  async validate(req:any, payload: JwtPayload): Promise<RefreshTokenData> {
    // 1. 토큰 타입 보안 검사 (Access Token을 Refresh Token처럼 쓰는 공격 방지)
    if (payload.type !== TokenType.REFRESH) {
      throw new UnauthorizedException('Invalid token type');
    }

    // 2. 쿠키에서 원본 토큰 문자열 추출 (Redis 대조나 갱신 시 필요함)
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // 3. 최종 반환값 -> @CurrentRefreshToken() 데코레이터나 req.user에서 사용됨
    return {
      payload,
      refreshToken,
    };
  }
}

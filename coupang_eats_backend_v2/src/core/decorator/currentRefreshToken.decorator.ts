import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RefreshTokenData } from '../jwt/jwt.interface';

/**
 * 요청(Request)에서 Refresh Token 정보를 쉽게 꺼내기 위한 데코레이터
 */
export const CurrentRefreshToken = createParamDecorator(
  (data: keyof RefreshTokenData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // RefreshTokenGuard가 검증 후 request.user에 넣어둔 데이터를 가져온다.
    const refreshTokenData: RefreshTokenData = request.user;

    // 데코레이터에 인자가 있으면 해당 필드를, 없으면 토큰 문자열을 반환한다.
    return data ? refreshTokenData[data] : refreshTokenData.refreshToken;
  },
);

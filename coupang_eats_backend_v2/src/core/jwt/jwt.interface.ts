import { Union } from '../../common/type/common.interface';
import { User } from '../../entities/user/user.entity';

export const TokenType = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;
export type TokenType = Union<typeof TokenType>;

export interface JwtPayload {
  sub: User['id'];
  type: TokenType;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface DecodedToken {
  payload: JwtPayload;
  expired: boolean;
}

export interface RefreshTokenData {
  payload: JwtPayload;
  refreshToken: string;
}

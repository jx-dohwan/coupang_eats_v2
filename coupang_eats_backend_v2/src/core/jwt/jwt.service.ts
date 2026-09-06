import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { MoinConfigService } from '../config/config.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys, CacheServiceKey } from '../cache/cache.interface';
import { LoggerService } from '../logger/logger.service';
import {
  DecodedToken,
  JwtPayload,
  TokenPair,
  TokenType,
} from './jwt.interface';
import { User } from '../../entities/user/user.entity';

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiration: string;
  private readonly refreshExpiration: string;

  constructor(
    @Inject(CacheServiceKey) private readonly cacheService: CacheService,
    private readonly nestJwtService: NestJwtService,
    private readonly configService: MoinConfigService,
    private readonly loggerService: LoggerService,
  ) {
    const jwtConfig = this.configService.getJwtConfig();
    this.accessSecret = jwtConfig.JWT_ACCESS_SECRET;
    this.refreshSecret = jwtConfig.JWT_REFRESH_SECRET;
    this.accessExpiration = jwtConfig.JWT_ACCESS_EXPIRATION;
    this.refreshExpiration = jwtConfig.JWT_REFRESH_EXPIRATION;
  }

  // 1. 토큰 생성 섹션 - 로그인 시 주로 사용
  // Access/Refresh 토큰 쌍을 생성하고 Refresh 토큰을 Redis에 저장
  async generateTokenPair(userId: User['id']): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId),
      this.generateRefreshToken(userId),
    ]);
    await this.storeRefreshToken(userId, refreshToken);
    return { accessToken, refreshToken };
  }

  // Access Token 단독 생성
  async generateAccessToken(userId: User['id']): Promise<string> {
    const payload: JwtPayload = { sub: userId, type: TokenType.ACCESS };
    return this.nestJwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiration as any,
    });
  }

  // Refresh Token 단독 생성
  async generateRefreshToken(userId: User['id']): Promise<string> {
    const payload: JwtPayload = { sub: userId, type: TokenType.REFRESH };
    return this.nestJwtService.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiration as any,
    });
  }

  // 2. 토큰 검증 섹션 - 가드(Guard)나 전략(Strategy)에서 사용
  // Access Token 검증
  async verifyAccessToken(token: string): Promise<DecodedToken> {
    try {
      const payload = await this.nestJwtService.verifyAsync<JwtPayload>(token, {
        secret: this.accessSecret,
      });
      if (payload.type !== TokenType.ACCESS) {
        throw new UnauthorizedException('Invalid token type');
      }
      return { payload, expired: false };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        const payload = this.nestJwtService.decode(token) as JwtPayload;
        return { payload, expired: true };
      }
      throw error;
    }
  }

  // Refresh Token 검증 (Redis 대조 포함)
  async verifyRefreshToken(token: string): Promise<DecodedToken> {
    try {
      const payload = await this.nestJwtService.verifyAsync<JwtPayload>(token, {
        secret: this.refreshSecret,
      });

      if (payload.type !== TokenType.REFRESH) {
        throw new UnauthorizedException('Invalid token type');
      }
      const storedToken = await this.getStoredRefreshToken(payload.sub);
      if (storedToken !== token) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return { payload, expired: false };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        const payload = this.nestJwtService.decode(token) as JwtPayload;
        return { payload, expired: true };
      }
      throw error;
    }
  }

  // Access Token이 블랙리스트에 있는지 확인
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklistKey = this.getBlacklistKey(token);
    const isBlacklisted = await this.cacheService.get(blacklistKey);
    return !!isBlacklisted;
  }

  // 3. 토큰 갱신 섹션 - 토큰 만료 시 사용

  // Refresh Token을 사용하여 새로운 토큰 쌍 발급(RTR)
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const { payload, expired } = await this.verifyRefreshToken(refreshToken);
    if (expired) {
      throw new UnauthorizedException('Refresh token expired');
    }
    return this.generateTokenPair(payload.sub);
  }

  // 4. 토큰 페기 섹션 - 로그아웃 시 사용
  // 로그아웃 (Redis에서 Refresh Token 삭제 + Access Token 블랙리스트 처리)
  async revokeAllUserTokens(
    userId: User['id'],
    accessToken: string,
  ): Promise<void> {
    await this.revokeRefreshToken(userId);

    const blacklistKey = this.getBlacklistKey(accessToken);
    const ttl = this.parseExpirationToSeconds(this.accessExpiration);
    await this.cacheService.set(blacklistKey, true, ttl);
  }

  // Refresh Token만 삭제
  async revokeRefreshToken(userId: User['id']): Promise<void> {
    const key = this.getRefreshTokenKey(userId);
    await this.cacheService.del(key);
  }

  // 5. Private Helper 섹션 - 내부 로직 (Redis 키 생성, 시간 변환 등)
  private async storeRefreshToken(
    userId: User['id'],
    refreshToken: string,
  ): Promise<void> {
    const key = this.getRefreshTokenKey(userId);
    const ttl = this.parseExpirationToSeconds(this.refreshExpiration);
    await this.cacheService.set(key, refreshToken, ttl);
  }

  private async getStoredRefreshToken(
    userId: User['id'],
  ): Promise<string | null> {
    const key = this.getRefreshTokenKey(userId);
    return this.cacheService.get(key);
  }

  private getRefreshTokenKey(userId: User['id']): string {
    return `${CacheKeys.RefreshToken}${userId}`;
  }

  private getBlacklistKey(token: string): string {
    return `${CacheKeys.TokenBlacklist}${token}`;
  }

  private parseExpirationToSeconds(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1));
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return 3600;
    }
  }
}

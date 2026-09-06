import { Union } from '../../common/type/common.interface';

// CacheService 주입용 커스텀 토큰
export const CacheServiceKey = Symbol('CacheServiceKey');
// Redis 클라이언트 주입용 커스텀 토큰
export const RedisClientKey = Symbol('RedisClientKey');

// 캐시 키(prefix)를 상수로 관리하여 오타 방지
export const CacheKeys = {
  RefreshToken: 'refresh-token/',
  TokenBlacklist: 'token-blacklist/',
  User: 'user/', // 사용자 관련 캐시 키 접두사
} as const;
export type CacheKeys = Union<typeof CacheKeys>;

/**
 * @Cache() 데코레이터에서 사용할 옵션 타입 정의
 */
export interface ICacheOptions {
  key: string; // 캐시 키 (접두사). (예: CacheKeys.User)
  ttl: number; // 만료 시간 (초)
  index?: number; // 동적 키로 사용할 메서드 인자의 순서 (0이면 첫 번째 인자)
}

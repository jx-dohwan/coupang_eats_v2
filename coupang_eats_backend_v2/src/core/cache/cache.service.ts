import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisClientKey } from './cache.interface';

@Injectable()
export class CacheService {
  /**
   * 생성자에서 @Inject(RedisClientKey)를 사용해 Redis 클라이언트를 주입받습니다.
   */
  constructor(@Inject(RedisClientKey) private readonly redis: Redis) {}

  /**
   * [비공개 헬퍼] 키에 만료 시간(TTL)을 설정합니다.
   * @param key Redis 키
   * @param ttl 만료 시간(초). 0이면 즉시 만료될 수 있습니다.
   */
  private async setTTL(key: string, ttl: number = 0) {
    return this.redis.expire(key, ttl);
  }

  /**
   * Redis에서 키에 해당하는 값을 가져옵니다.
   * @param key Redis 키
   * @returns 값이 있으면 JSON 파싱(객체 복원) 후 반환, 없으면 null 반환
   */
  public async get(key: string): Promise<string | null> {
    const data = await this.redis.get(key);
    if (data) {
      // Redis에는 문자열로 저장되므로, 원래 객체 형태로 복원합니다.
      return JSON.parse(data);
    }
    return null;
  }

  /**
   * Redis에 키-값을 저장하고, 선택적으로 만료 시간을 설정합니다.
   * @param key Redis 키
   * @param value 저장할 값 (객체 등)
   * @param ttl 만료 시간(초)
   */
  public async set(key: string, value: string | number | boolean, ttl?: number) {
    // 객체(value)를 Redis에 저장하기 위해 문자열로 직렬화합니다.
    const serializedValue = JSON.stringify(value);

    await this.redis.set(key, serializedValue);

    // ttl이 제공된 경우에만 만료 시간을 설정합니다.
    if (ttl) {
      await this.setTTL(key, ttl);
    }
  }

  /**
   * Redis에서 특정 키를 삭제합니다. (데이터 업데이트 시 캐시 무효화용)
   */
  public async del(key: string) {
    await this.redis.del(key);
  }
}

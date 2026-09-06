import { SetMetadata } from '@nestjs/common';
import { ICacheOptions } from './cache.interface';

// @Cache() 데코레이터가 사용할 메타데이터의 고유 키(key)
export const CACHE_KEY = 'CACHE';

/**
 * 특정 핸들러(컨트롤러의 메서드)에 대한 캐시 옵션을 설정하는 데코레이터 팩토리 함수.
 * 이 데코레이터를 메서드에 적용하면, 해당 메서드의 응답을 캐시하는데 사용된다.
 * @param options - 캐시 키와 만료 시간을 포함하는 객체
 * @returns
 */
export const Cache = (options: ICacheOptions) => {
  // 'CACHE'키에 'options'객체를 메타데이터로 저장한다. 나중에 캐시 인터셉터가 이 메타데이터를 읽어 사용한다.
  return SetMetadata(CACHE_KEY, options);
};

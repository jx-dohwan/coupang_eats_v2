import {
  ClassProvider,
  FactoryProvider,
  Inject,
  Module,
  OnModuleInit, // 모듈 초기화 라이프사이클 훅
} from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import {
  CacheServiceKey,
  ICacheOptions,
  RedisClientKey,
} from './cache.interface';
import {
  DiscoveryModule, // NestJS 앱의 모든 프로바이더/컨트롤러를 스캔하는 모듈
  DiscoveryService, // 스캔 서비스
  MetadataScanner, // 클래스의 메서드를 스캔하는 서비스
  Reflector, // 데코레이터의 메타데이터를 읽는 서비스
} from '@nestjs/core';
import { LoggerService } from '../logger/logger.service';
import { CACHE_KEY } from './cache.decorator'; // '@Cache' 데코레이터의 메타데이터 키
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '../config/config.module';
import { LoggerModule } from '../logger/logger.module';
import { MoinConfigService } from '../config/config.service';

/**
 * 'RedisClientKey' 토큰으로 Redis 클라이언트 인스턴스를 생성/제공하는 팩토리
 */
const redisConnect: FactoryProvider = {
  provide: RedisClientKey,
  inject: [MoinConfigService], //  MoinConfigService 주입
  useFactory: async (configService: MoinConfigService) => {
    // 1. 설정값 가져오기
    const redisConfig = configService.getRedisConfig();

    // 2. [중요] 포트 타입 변환 (string | number -> number)
    // 환경변수는 문자열로 올 수 있으므로 반드시 숫자로 변환해야 ioredis 에러가 안 납니다.
    const port = Number(redisConfig.PORT) || 6379;
    const host = redisConfig.HOST || '127.0.0.1';
    

    // 3. 디버깅용 로그 (배포 후 CloudWatch에서 주소 확인용)
    console.log(`[Redis Config] Connecting to: ${host}:${port}`);

    const isLocal = host === 'localhost' || host === '127.0.0.1';

    // 4. Redis 클라이언트 생성
    const client = new Redis({
      host: host,
      port: port, // 이제 확실한 number 타입입니다.
      ...(isLocal ? {} : { tls: {} }), // 로컬이 아닐 때만 tls 옵션 적용 (AWS ElastiCache 등 사용 시 필요)
      retryStrategy: (times) => Math.min(times * 50, 2000), // 재연결 전략
    });

    // 5. 에러 리스너 등록 (연결 끊김 시 로그 출력)
    client.on('error', (err) => {
      console.error('[Redis Error]', err);
    });

    return client;
  },
};
/**
 * 'CacheServiceKey' 토큰으로 CacheService를 등록/제공
 */
const cacheService: ClassProvider = {
  provide: CacheServiceKey,
  useClass: CacheService,
};

@Module({
  imports: [DiscoveryModule, ConfigModule, LoggerModule], // 다른 모듈을 스캔하기 위해 DiscoveryModule 임포트
  providers: [redisConnect, cacheService],
  exports: [cacheService],
})
// OnModuleInit: NestJS 앱이 초기화될 때(모든 모듈 로드 후) 코드를 실행
export class CacheModule implements OnModuleInit {
  constructor(
    @Inject(CacheServiceKey) private readonly cacheService: CacheService,
    private readonly discoveryService: DiscoveryService, // 앱의 모든 구성요소(프로바이더 등) 스캔
    private readonly metadataScanner: MetadataScanner, // 클래스의 메서드 목록 스캔
    private readonly reflector: Reflector, // 데코레이터 메타데이터 읽기
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * 모듈이 초기화될 때 자동으로 'wrapCache'를 실행합니다.
   */
  async onModuleInit() {
    this.wrapCache();
  }

  /**
   * (핵심 로직 1)
   * 원본 메서드를 캐시 기능이 있는 새 메서드로 '래핑(Wrapping)'(감싸기)합니다.
   * @param originalMethod - 캐시할 원본 메서드 (예: UserService.getUser)
   * @param instance - 원본 메서드가 속한 인스턴스 (예: UserService)
   * @param cacheOptions - @Cache() 데코레이터에서 받은 옵션 (key, ttl)
   */
  private wrapMethod(
    originalMethod: any,
    instance: any,
    cacheOptions: ICacheOptions,
  ) {
    const { loggerService, cacheService } = this;
    const { ttl, key, index } = cacheOptions;

    // 원본 메서드를 대체할 '새로운 비동기 함수'를 반환합니다.
    return async function (...args: any[]) {
      // (1) 동적 캐시 키 생성
      // index 옵션 (예: 0)을 사용해 메서드의 첫 번째 인자(userId)를 키 접미사로 사용
      const keyIndex = index ?? 0; // index 옵션이 없으면 0번째 인자 사용
      const keyArgument = args[keyIndex]; // 예: getUser(userId)의 'userId' 값
      const keySuffix = typeof keyArgument === 'string' ? keyArgument : '';
      // 최종 캐시 키 조합 (예: 'user/' + 'userId값')
      const cacheKey = `${key}${keySuffix}`;

      try {
        // (2) 캐시 조회 (Cache Hit)
        const cachedData = await cacheService.get(cacheKey);
        if (cachedData) {
          loggerService.info(cacheKey, cachedData, 'cache hit');
          return cachedData; // 캐시된 데이터 반환
        }
      } catch (error) {
        // 캐시 조회 중 에러 발생 시, 캐시를 무시하고 원본 메서드 실행
        loggerService.error(CACHE_KEY, error, 'cache error on get');
        return await originalMethod.apply(instance, args);
      }

      // (3) 캐시 실패 (Cache Miss)
      // 원본 메서드(예: DB 조회)를 실행합니다.
      const result = await originalMethod.apply(instance, args);

      try {
        // (4) 결과를 캐시에 저장
        await cacheService.set(cacheKey, result, ttl);
        loggerService.info(cacheKey, result, 'cache miss');
      } catch (error) {
        // 캐시 저장 중 에러가 발생해도, 결과는 정상 반환
        loggerService.error(CACHE_KEY, error, 'cache error on set');
      } finally {
        return result; // 원본 메서드의 결과 반환
      }
    };
  }

  /**
   * (핵심 로직 2)
   * 특정 인스턴스(예: UserService)의 모든 메서드를 스캔하여
   * @Cache 데코레이터가 붙은 메서드를 찾아 'wrapMethod'로 교체합니다.
   */
  private wrapInstanceMethods(instance: any) {
    // MetadataScanner로 클래스의 모든 메서드 이름을 가져옵니다.
    const methodNames = this.metadataScanner.getAllMethodNames(
      Object.getPrototypeOf(instance.instance),
    );

    for (const methodName of methodNames) {
      const originalMethod = instance.instance[methodName];
      // Reflector로 메서드에 @Cache() 데코레이터(CACHE_KEY)의 메타데이터가 있는지 확인
      const cacheOptions = this.reflector.get(CACHE_KEY, originalMethod);

      if (cacheOptions) {
        // (메서드 교체)
        // @Cache가 붙어있으면, 원본 메서드를 wrapMethod가 반환한 새 함수로 덮어씁니다.
        instance.instance[methodName] = this.wrapMethod(
          originalMethod,
          instance.instance,
          cacheOptions,
        );
      }
    }
  }

  /**
   * (핵심 로직 3)
   * DiscoveryService를 사용해 NestJS 앱에 등록된 모든 프로바이더(서비스)를 가져옵니다.
   */
  private getInstances() {
    return this.discoveryService
      .getProviders() // 모든 프로바이더 스캔
      .filter((v) => v.isDependencyTreeStatic())
      .filter(({ metatype, instance }) => instance && metatype); // 실제 인스턴스가 있는 것만 필터링
  }

  /**
   * (엔진 시작)
   * 앱의 모든 인스턴스를 가져와서, 각 인스턴스의 메서드를 스캔/래핑합니다.
   */
  private wrapCache() {
    const instances = this.getInstances();
    for (const instance of instances) {
      this.wrapInstanceMethods(instance);
    }
  }
}

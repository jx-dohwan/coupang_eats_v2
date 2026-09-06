import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig, AwsConfig, Configurations, DBConfig, JwtConfig, RedisConfig } from '.';

// 이 서비스가 다른 곳에 주입될수 있음을 Nest.js에게 알린다.
@Injectable()
// 설정값을 사용할때 자동 완성의 이점을 누리고, 타입 오류나 오타로 인한 버그를 컴파일 시점에서 미리 잡을 수 있게 해준다.
// 기본 configService는 오타, 타입, 설정값등을 다 외워야 하는 문제가 있는데, 이를 개선한 것이다.
export class MoinConfigService {
  // Nest.js의 ConfigService를 주입받는다.
  // 제너릭으로 get()의 반환 타입을 미리 정의한다.
  constructor(private readonly configService: ConfigService<Configurations>) {}

  // 'APP' 설정 객체를 가져온다
  getAppConfig(): AppConfig {
    // APP 키로 설정을 조회하며, 값이 없으면 오류를 발생시킨다.
    return this.configService.getOrThrow('APP');
  }

  getDBConfig(): DBConfig {
    // 'DB' 키로 설정을 조회하며, 값이 없으면 오류를 발생시킵니다.
    return this.configService.getOrThrow('DB');
  }

  getRedisConfig(): RedisConfig {
    return this.configService.getOrThrow('REDIS');
  }

  getJwtConfig(): JwtConfig {
    return this.configService.getOrThrow('JWT');
  }

  getAwsConfig(): AwsConfig {
    return this.configService.getOrThrow('AWS');
  }
}

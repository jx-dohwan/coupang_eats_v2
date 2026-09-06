import {
  ClassProvider,
  Global,
  MiddlewareConsumer,
  Module,
} from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiResponseInterceptor } from './interceptor/apiResponse.interceptor';
import { TypeOrmModule } from './database/typeorm/typeorm.module';
import { LoggerModule } from './logger/logger.module';
import { CacheModule } from './cache/cache.module';
import { JwtBlacklistGuard } from './guard/jwtBlacklist.guard';
import { AccessTokenGuard } from './guard/accessToken.guard';
import { JwtModule } from './jwt/jwt.module';
import { ClsModule } from './cls/cls.module';
import { ClsMiddleware } from 'nestjs-cls';
import { RequestLoggerMiddleware } from './middleware/requestLogger.middleware';
import { ErrorFilter } from './filter/error.filter';
import { ScheduleModule } from '@nestjs/schedule';
import { AwsModule } from './aws/aws.module';

// CoreModule이 공통으로 관리할 모듈 목록(설정, 로거)
const modules = [
  ConfigModule,
  LoggerModule,
  CacheModule,
  JwtModule,
  ClsModule,
  AwsModule,
];

// CoreModule이 제공할 프로바이더 목록 (현재는 비어 있음))
const providers: ClassProvider[] = [];

// 애플리케이션 전역으로 적용할 인터셉터 목록
const interceptor: ClassProvider[] = [
  // 1. API 응답 형식을  통일된 구조로 래핑하는 인터셉터
  { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
];

const guards: ClassProvider[] = [
  {
    provide: APP_GUARD,
    useClass: JwtBlacklistGuard,
  },
  {
    provide: APP_GUARD,
    useClass: AccessTokenGuard,
  },
];

// 애플리케이션 전역으로 적용할 예외 필터 목록
const filters: ClassProvider[] = [
  { provide: APP_FILTER, useClass: ErrorFilter },
];

@Global()
@Module({
  imports: [TypeOrmModule.forRoot(), ScheduleModule.forRoot(), ...modules],
  providers: [...providers, ...interceptor, ...filters, ...guards],
  exports: [...modules, ...providers],
})
export class CoreModule {
  // 요청이 들어왔을때 가장 먼젓 실행되는 파이프라인을 구성 순서가 매우 중요, 미들웨어 설정
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ClsMiddleware) // CLS 미들웨어: 요청이 들어오자마다 고유ID를 생성하고 컨텍스트를 연다.
      .forRoutes('*') // 모든 경로에 적용
      .apply(RequestLoggerMiddleware) // 로깅 미들웨어: 위에서 생성된 ID를 기반으로 요청 시작 로그를 남긴다. 반드시 CLS뒤에 와야 ID를 가져올 수 있음
      .forRoutes('*'); // 모든 경로에 적용
  }
}

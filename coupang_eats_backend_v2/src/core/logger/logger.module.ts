import { Global, Module } from '@nestjs/common';
import { utilities, WinstonModule } from 'nest-winston';
import winston from 'winston';
import { LoggerService } from './logger.service';
import { MoinConfigService } from '../config/config.service';
import { Env } from '../config';

/**
 * [전역 로거 모듈]
 */
@Global() // 모듈을 전역 모듈로 선언, 여기에서 export된 LoggerService는 다른 모듈에서 import에 추가하지 않아도 바로 주입 가능
@Module({
  imports: [
    // WinstonModule을 비동기(Async)로 설정
    WinstonModule.forRootAsync({
        // MoinConfigService를 주입받아 useFactory에서 사용한다..
      inject: [MoinConfigService],
      // useFactory: 주입받은 서비스를 바탕으로 Winston 설정을 동적으로 생성한다.
      useFactory: (configsService: MoinConfigService) => {
        const { ENV, NAME } = configsService.getAppConfig();
        const isDeployedEnv = ENV !== Env.local && ENV !== Env.test;

        // local과 test 환경이 아닌, 배포 환경 
        if (isDeployedEnv) {
          return {
            transports: [new winston.transports.Console({ level: 'info' })],
          };
        }

        // 로컬 및 테스트 환경 설정
        return {
          transports: [
            new winston.transports.Console({
                // 'test' 환경은 'verbose', 'local' 환경은 'silly' (가장 상세) 레벨로 설정
              level: ENV === Env.test ? 'verbose' : 'silly',
              // winston 포맷을 조합합니다.
              format: winston.format.combine(
                // 타임스탬프 추가
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                // nest-winston 유틸리티: Nest.js 기근데본 로거처럼 색상과 형식을 예쁘게
                utilities.format.nestLike(NAME, {
                  prettyPrint: true,
                  colors: true,
                }),
              ),
            }),
          ],
        };
      },
    }),
  ],
  // 이 모듈에서 사용할 프로바이더로 커스텀 LoggerService를 등록
  providers: [LoggerService],
  // LoggerService를 다른 모듈에서 주입할 수 있도록 export
  exports: [LoggerService],
})
export class LoggerModule {}

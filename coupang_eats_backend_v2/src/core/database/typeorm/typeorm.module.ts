import { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  TypeOrmModule as OrmModule,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import * as path from 'path';
import { Env } from '../../config';
import { MoinConfigService } from '../../config/config.service';
import { DataSourceOptions, DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import {
  initializeTransactionalContext,
  addTransactionalDataSource,
  deleteDataSourceByName,
} from 'typeorm-transactional';

/**
 * [커스텀 TypeOrmModule]
 * Nest.js의 TypeOrmModule을 래핑(wrapping)하여
 * 1. 싱글톤 보장
 * 2. MoinConfigService를 사용한 비동기 설정
 * 3. 'typeorm-transactional'연동
 * 기능을 제공하는 커스텀 모듈
 */
export class TypeOrmModule {
  // 모듈 인스턴스를 저장하기 위한 private static 변수 (싱글톤 패턴)
  private static instance?: DynamicModule;

  /**
   *
   * @returns
   * 앱 전역에서 단 한 번만 TypeORM 모듈을 초기화 한다.
   */

  static forRoot(): DynamicModule {
    // 1. 싱글톤 구현: 인스턴스가 이미 생성되었다면 그것을 반환
    if (!this.instance) {
      // 'typeorm-transactional'을 사용하기 위한 초기 컨텍스트 설정
      initializeTransactionalContext();

      // 2. 비동기 모듈 생성
      this.instance = OrmModule.forRootAsync({
        imports: [ConfigModule], // ConfigService를 사용하기 위해 ConfigModule dlavhxm
        inject: [MoinConfigService], // MoinConfigService를 주입 받음

        // 3. useFactory: 실제 설정 객체를 생성하는 팩토리 함수
        useFactory: async (
          configService: MoinConfigService,
        ): Promise<TypeOrmModuleOptions> => {
          // 주입받은 MoinConfigService로 DB 및 APP 설정값을 가져옴
          const dbConfig = configService.getDBConfig();
          const env = configService.getAppConfig().ENV;
          // 4. 환경별 엔티티 경로 분기
          // test 환경(ts-node)에서는 .ts 파일을,
          // dev/prod 환경(node)에서는 컴파일된 .js 파일을 읽도록 경로 설정
          const isDevelopment = env === Env.test || env === Env.local;

          const entitiesPath = path.join(
            __dirname,
            './../../../entities/**/*.entity{.ts,.js}',
          );

          // TypeORM DataSource 서렂ㅇ 객체
          const options: DataSourceOptions = {
            type: 'mysql', // (RDBMS에 맞게 postgres 등으로 변경 가능)
            host: dbConfig.DB_HOST,
            port: Number(dbConfig.DB_PORT), // .env 파일에서 가져온 값은 문자열일 수 있으므로 Number로 변환

            database: dbConfig.DB_DATABASE,
            username: dbConfig.DB_USER_NAME,
            password: dbConfig.DB_PASSWORD,
            entities: [entitiesPath], // 위에서 설정한 동적 엔티티 경로
            namingStrategy: new SnakeNamingStrategy(), // 스네이크 케이스 자동 변환

            // 5. 환경별 스키마 동기화 설정
            // test 환경에서는 스키마 자동 동기화(true)
            // dev/prod 환경에서는 마이그레이션을 사용해야 하므로 비활성화(false)
            synchronize: isDevelopment,
            logging: true, // 운영 환경에서는 false, 개발 시 true로 변경 가능
            connectorPackage: 'mysql2',
          };
          return options;
        },
        // 6. dataSourceFactory: 'typeorm-transactional'연동
        // TypeORM이 DataSoruce를 생성할 때 이 팰토리를 사용한다.
        async dataSourceFactory(options?: DataSourceOptions) {
          console.log('🔥 [DEBUG] Transactional DataSource Created!');
          if (!options) throw new Error('Invalid options passed');
          // 생성된 DataSource를 'typeorm-transactional'이 관리할 수 있도록
          // 'addTransactionalDataSource'로 래핑하여 반환
          return addTransactionalDataSource(new DataSource(options));
        },
      });
    }
    // 생성했거나, 이미 존재하던 인스턴스를 반환
    return this.instance;
  }
}

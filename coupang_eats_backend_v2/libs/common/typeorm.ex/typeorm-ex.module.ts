import { DynamicModule, Provider } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TYPEORM_EX_CUSTOM_REPOSITORY } from './typeorm-ex.decorator';

/**
 * @CustomRepository 데코레이터가 붙은 커스텀 리포지토리들을
 * Nest.js의 의존성 주입 시스템에 동적으로 등록해주는 모듈이다.
 */
export class TypeOrmExModule {
  /**
   * 커스텀 리포지토리 클래스의 배열을 받아,
   * 이들을 프로바이더로 등록하는 동적 모듈을 생성
   * @param repositories Appmodule 등에서 등록할 커스텀 리포지토리 클래스 배열
   * @returns
   */
  public static forCustomRepository<T extends new (...args: any[]) => any>(
    repositories: T[],
  ): DynamicModule {
    // nest.js DI 컨테이너에 등록될 프로바이더 목록
    const providers: Provider[] = [];

    // AppModule에서 전달받은 리포지토리 클래스들을 하나씩 순회
    for (const repository of repositories) {
      // 1. @CustomRepository(User) 데코레이터가 클래스에 저장한 메타데이터(User 엔티티)를 읽어온다.
      const entity = Reflect.getMetadata(
        TYPEORM_EX_CUSTOM_REPOSITORY, // 데코레이터에서 사용한 키
        repository, // 메타데이터를 읽을 대상 클래스(리포지토리)
      );

      // 메타데이터가 없으면(데코레이터가 없으면) 프로바이더로 등록하지 않고 건너뚜니다.
      if (!entity) {
        continue;
      }

      // 2. Nest.js가 인식할 수 있는 프로바이더 객체를 생성한다.
      providers.push({
        // 이 프로바이더(커스텀 리포지토리)를 생성하기 위해
        // TypeORM의 핵심 'DataSource'가 필요함을 명시한다.
        inject: [getDataSourceToken()],

        // DI 시스템에서 사용할 '토큰'.
        // (예: @Inject(UserRepository) 할 수 있도록 클래스 자체를 토큰으로 사용)
        provide: repository,

        // 'useFactory'는 inject에 명시된 의존성(DataSource)을 받아
        // 실제 인스턴스를 동적으로 생성하는 함수이다.
        // useFactory: (DataSource: DataSource): typeof repository => {
        //   // 3. DataSource에서 해당 엔티티의 기본 TypeORM 리포지토리를 가져온다.
        //   const baseRepository = DataSource.getRepository<any>(entity);

        //   // 4. '커스텀 리포지토리'의 새 인스턴스를 생성한다.
        //   // (Repository를 상속받은 클래스는 생성자로 3개의 인자를 받으므로 BaseRepository의 정보를 전달하여 인스턴스화한다.)
        //   return new repository(
        //     baseRepository.target,
        //     baseRepository.manager,
        //     baseRepository.queryRunner,
        //   );
        // },
        useFactory: (dataSource: DataSource): typeof repository => {
          // 1. 데코레이터에서 엔티티 정보를 직접 가져옵니다. (절대 undefined일 수 없음)
          const entityClass = Reflect.getMetadata(
            TYPEORM_EX_CUSTOM_REPOSITORY,
            repository,
          );

          // 2. DataSource에서 해당 엔티티의 리포지토리를 가져옵니다.
          const baseRepository = dataSource.getRepository(entityClass);

          // 3. 생성자에 'baseRepository.target' 대신 'entityClass' 자체를 넣습니다.
          const instance = new repository(
            entityClass, // 메타데이터 유실 방지: 엔티티 클래스 직접 주입
            baseRepository.manager,
            baseRepository.queryRunner,
          );
          return instance;
        },
      });
    }

    // 5. Nest.js에 등록할 동적 모듈 객체를 반환한다.
    return {
      module: TypeOrmExModule,
      providers: providers, // DI 컨테이너에 등록할 프로바이더 목록
      exports: providers, // 다른 모듈에서 이 프로바이더들을 주입할 수 있도록 공개
    };
  }
}

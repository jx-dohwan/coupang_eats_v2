import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { 
  initializeTransactionalContext, 
  StorageDriver 
} from 'typeorm-transactional';

// Mock 클래스와 토큰 import
import { AwsS3Service } from '../../src/core/aws/aws-s3.service';
import { AwsSesService } from '../../src/core/aws/aws-ses.service';
import { MockAwsS3Service, MockAwsSesService } from './mock-aws';
import { NOTIFICATION_SERVICE } from '../../src/core/notification/notification.interface';

export async function createTestApp() {
  // 1. 트랜잭션 컨텍스트 초기화 (옵션 명시)
  try {
    initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });
  } catch (e) {
    // 이미 초기화된 경우 무시
  }

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // ✅ 인터페이스 토큰 오버라이딩
    .overrideProvider(NOTIFICATION_SERVICE)
    .useClass(MockAwsSesService)
    
    // ✅ 클래스 토큰 오버라이딩 (RestaurantController용)
    .overrideProvider(AwsS3Service)
    .useClass(MockAwsS3Service)

    // ✅ AwsSesService 클래스 자체도 오버라이딩 (안전장치)
    .overrideProvider(AwsSesService)
    .useClass(MockAwsSesService)
    .compile();

  const app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  // ⚠️ [중요] DataSource가 트랜잭션 핸들러와 연결되었는지 확인하는 꼼수
  // 이걸 안 해주면 테스트 환경에서 DataSource가 멍청해질 때가 있음
  const dataSource = app.get(DataSource);
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  
  await dataSource.synchronize(true);

  return { app, dataSource };
}

export async function closeTestApp(
  app: INestApplication,
  dataSource: DataSource,
) {
  if (dataSource && dataSource.isInitialized) {
    // 연결 끊기 전에 잠시 대기 (비동기 작업 정리)
    await dataSource.destroy();
  }
  if (app) {
    await app.close();
  }
}
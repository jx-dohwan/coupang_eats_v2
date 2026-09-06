import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { NOTIFICATION_SERVICE } from './notification.interface';
import { ConfigModule } from '@nestjs/config';
import { AwsModule } from '../aws/aws.module';

@Module({
  imports: [
    ConfigModule, // 2. 여기에 반드시 추가해야 합니다!
    AwsModule, // (AwsSesService를 쓰기 위해 필요, 이미 Global이면 생략 가능하지만 명시 권장)
  ],
  providers: [
    {
      // [핵심 설정] 의존성 주입 규칙 정의
      // 누군가 'NOTIFICATION_SERVICE'를 달라고 요청하면,
      provide: NOTIFICATION_SERVICE,
      // 실제로는 'EmailService' 인스턴스를 생성해서 줘라.
      // (나중에 SmsService로 바꾸고 싶으면 여기만 수정하면 됨)
      useClass: EmailService,
    },
  ],
  // 다른 모듈(AuthModule 등)에서 이 서비스를 사용할 수 있도록 내보냄
  exports: [NOTIFICATION_SERVICE],
})
export class NotificationModule {}

import { Module } from '@nestjs/common';
import { RequestContextService } from './cls.service';
import { ClsModule as NestClsModule } from 'nestjs-cls';

@Module({
  imports: [
    NestClsModule.forRoot({
      global: true, // CLS 기능을 전역 모듈 사용 설정
      middleware: { // 미들웨어 설정
        mount: true, // 별도의 미들웨어 적용 코드 없이 자동으로 친 미들웨어 장착
        generateId: true, // 요청이 들어올 때마다 고유한 Request Id를 자동 생성, 나중에 로그 추척의 핵심
      },
    }),
  ],
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class ClsModule {}

import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

// 공통으로 사용하기 위해 설정을 변로 함수로 분리
export function setNestApp<T extends INestApplication>(app: T): void {
    // 1. 전역 유효성 검사 파이프(Global Pipe) 등록
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // 클라이언트가 보낸 JSON 데이터를 DTO 클래스의 인스턴스로 자동 변환
      transformOptions: { // 타입을 보고 자동으로 형변환을 시도
        enableImplicitConversion: true,
      },
    }),
  );
  // 2. 쿠키 파서 미들웨어 등록, Refresh Token을 HtpOnly 쿠키로 주고받기 위해서 반드시 필요하다.
  app.use(cookieParser());
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}
  
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      // catchError()는 스트림에서 오류가 발생했을 때 실행된다.
      catchError((err) => {
        const req = context.switchToHttp().getRequest();
        const {method, url, body, query, params} = req;
        const headers = req.headers;
        const requestId = headers['x-request-id']; // 미들웨어에서 만든 ㅑㅇ

        // 상태 코드 미리 계산(로그에 남기기 위함)
        const statusCode = err instanceof HttpException ? err.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

        // LoggerService를 사용해 에러 로그 기록(콘솔 -> AWS CloudWatch)
        this.logger.error(
          'Exception', // 로그 컨텍스트 이름 
          {
            method,
            url,
            requestId,
            statusCode,
            clientIp: req.ip,
            errorName: err.name, // 에러 종류
            stack: err.stack, // 에러 발생 위치
            body: JSON.stringify(body) // 요청 데이터 확인용
          },
          `Error: ${err.message}`, // 로그 메시지
        )

        // 기본 오류 응답 객체
        const returnObj = {
          success: false,
          message: err.message,
        };

        // 요류가 Nest.js의 HttpException(자식 클래스 포함)인 경우
        if (err instanceof HttpException) {
          // HttpException에서 미리 정의된 응답 페이로드와 상태 코드를 가져온다.
          const payload = err.getResponse();
          context.switchToHttp().getResponse().status(err.getStatus());

          // of()를 사용해 포맷팅된 오류 객체를 Observable 스트림으로 반환한다.
          // 이렇게 하면 오류 스트림이 성공 스트림으로 변환되어 클라이언트에 응답이 전달된다.
          return of({
            ...returnObj,
            // payload가 문자열일 수도, 객체일 수도 있으므로 분기 처리한다.
            ...(typeof payload === 'string' ? { message: payload } : payload),
          });
        }

        // HttpException이 아닌 예기치 못한 서버 오류인 경우 예를 들어 DB오류 등
        // 500 상태 코드를 설정한다.
        context
          .switchToHttp()
          .getResponse()
          .status(HttpStatus.INTERNAL_SERVER_ERROR);

        // 기본 오류 객체를 Observable로 반환한다.
        return of(returnObj);
      }),
    );
  }
}

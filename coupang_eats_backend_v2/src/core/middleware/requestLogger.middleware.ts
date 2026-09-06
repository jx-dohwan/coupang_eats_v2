import { HttpStatus, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { LoggerService } from '../logger/logger.service';
import { RequestContextService } from '../cls/cls.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly requestContextService: RequestContextService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // 1. 시간 측정 시작
    const startTime = Date.now();

    // 2. CLS에서 Request ID 가져오기, 이 ID는 가드, 서비스, 레포지토리, 필터 등 전역에서 공유됨
    const requestId = this.requestContextService.getRequestId();

    // 3. 응답 헤더에 ID 주입, 클라이언트가 트러블슈팅할 때 사용
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    // 4. 요청 정보 추출
    const { method, originalUrl, body, query, ip } = req;
    const userAgent = req.headers['user-agent'];

    // 5. 요청 시작 로그, 서버가 응답을 못 주고 멈췄을 때, 요청이 들어왔다는 사실을 알리기 위함
    this.loggerService.info(
      this.constructor.name,
      {
        requestId,
        method,
        url: originalUrl,
        body,
        query,
        ip,
        userAgent,
      },
      `Start Request: ${method} ${originalUrl}`,
    );

    // 요청 종료 로그
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      this.loggerService.info(
        this.constructor.name,
        {
          requestId,
          method,
          url: originalUrl,
          statusCode,
          duration,
        },
        `Finish Request: ${method} ${originalUrl} ${statusCode} - ${duration}ms`,
      );
    });
    next();
  }
}

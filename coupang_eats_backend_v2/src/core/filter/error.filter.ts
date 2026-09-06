import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';
import { MoinConfigService } from '../config/config.service';
import { Env } from '../config';
import passport from 'passport';

interface ErrorResponse {
  statusCode: number;
  message: string;
  path: string;
  error: string;
  stack?: string;
}

/**
 * 애플리케이션 전역에서 발생하는 모든 예외를 포착하여
 * 1. 보안을 위한 민감 정보 마스킹
 * 2. 구조화된 에러 로그 기록(Winston + CloudWatch)
 * 3. 클라이언트에게 통일된 에러 응답 반환의 역할을 수행
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly configService: MoinConfigService,
  ) {}

  /**
   * 로그에 남길 Request Body를 추출한다.
   * 로그인/회원가입 요청인 경우 비밀번호를 '*****'로 마스킹하여, 로그 파일에 평문 비밀번호가 남는 보안 사고를 방지한다.
   * @param request
   * @returns
   */
  private getRequestBody(request: Request): string {
    try {
      const isAuthRequest =
        request.url.includes('/auth/signup') ||
        request.url.includes('/auth/signin');

      return isAuthRequest
        ? JSON.stringify({ ...request.body, password: '******' })
        : JSON.stringify(request.body);
    } catch {
      this.loggerService.error(
        this.constructor.name,
        request.body,
        'failed stringify request body',
      );
      return JSON.stringify({});
    }
  }

  catch(exception: any, host: ArgumentsHost) {
    const env = this.configService.getAppConfig().ENV;
    const isProduction = env === Env.prod;

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    // 미들웨어(CLS)에서 생성한 고유 Request Id 가져옴, 추적용
    const requestId = request.headers['x-request-id'] as string;

    // 기본값: 500 내부 서버 오류
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = exception.message || 'Internal Server Error';
    let payload: any = {};

    // Nest.js 표준 예외인 경우, 해당 상태 코드와 메시지를 따름
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const httpPayload = exception.getResponse();
      if (typeof httpPayload === 'string') {
        message = httpPayload;
      } else {
        payload = httpPayload;
        message = (httpPayload as any).message || message;
      }
    }

    // 에러 응답 객체 생성, 프로덕현 환경에서는 보안을 위해 스택 트레이스를 숨김
    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      path: request.url,
      error: exception.name || 'Error',
      ...(isProduction ? {} : { stack: exception.stack }),
    };

    const requestBody = this.getRequestBody(request);

    // 로그에 남길 요청 정보 요약
    const req = {
      method: request.method,
      url: request.url,
      query: request.query,
      body: requestBody,
    };

    const res = {
      status: statusCode,
      headers: response.getHeaders(),
    };

    // 500번대 서버 에러는 심각한 문제이므로 Error 레벨로 별도 기록
    if (statusCode >= 500) {
      this.loggerService.error(
        this.constructor.name,
        errorResponse,
        'An error occurred.',
      );
    }

    // 모든 에러 상황에 대해 상세 정보를 Warn 레벨로 구조화하여 기록 (CloudWatch 검색용)
    this.loggerService.warn(
      this.constructor.name,
      {
        request: req,
        response: res,
        body: errorResponse,
        exception: exception?.stack,
        requestId,
      },
      `RESPONSE(ERROR): [${request.method}]${request.url}`,
    );

    // 클라이언트에게 보낼 최종 응답 객체(통일된 포맷)
    const returnObj = {
      success: false,
      ...errorResponse,
      ...payload,
    };

    return response.status(statusCode).json(returnObj);
  }
}

import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { CoreOutput } from '../../common/dto/core.output';
import { ErrorResponse } from '../../common/dto/error.response';

// [수정] responseType 타입을 변경합니다. (단일 객체 또는 배열 허용)
export function ApiDocOk(
  summary: string,
  responseType?: Type<any> | [Function],
) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiBearerAuth('access-token'),
    ApiOkResponse({
      description: '요청 성공',
      // 배열이 들어오면 그대로 넘겨주고, 없으면 기본값 CoreOutput
      type: responseType || CoreOutput,
    }),
    ApiResponse({
      status: 400,
      description: '잘못된 요청',
      type: ErrorResponse,
    }),
    ApiResponse({
      status: 500,
      description: '서버 내부 오류',
      type: ErrorResponse,
    }),
  );
}

export function ApiDocCreated(summary: string, responseType?: Type<any>) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiBearerAuth('access-token'),
    ApiCreatedResponse({
      description: '생성/수정 성공',
      type: responseType || CoreOutput,
    }),
    ApiResponse({
      status: 400,
      description: '잘못된 요청',
      type: ErrorResponse,
    }),
    ApiResponse({
      status: 401,
      description: '인증 실패 (토큰 없음)',
      type: ErrorResponse,
    }),
    ApiResponse({ status: 403, description: '권한 없음', type: ErrorResponse }),
  );
}


export function ApiDocPublicCreated(summary: string, responseType?: Type<any>) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiCreatedResponse({
      description: '생성 성공',
      type: responseType || CoreOutput,
    }),
    ApiResponse({ status: 400, description: '잘못된 요청', type: ErrorResponse }),
  );
}
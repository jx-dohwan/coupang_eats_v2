import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponse {
  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 메시지',
    example: '요청하신 리소스를 찾을 수 없습니다.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[];

  @ApiProperty({
    description: '에러 타입',
    example: 'Not Found',
  })
  error: string;

  @ApiProperty({
    description: '에러 발생 시각',
    example: '2024-01-01T12:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/orders/123',
  })
  path: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class CoreOutput {
  @ApiProperty({
    description: '요청 성공 여부',
    example: true,
  })
  ok: boolean;

  @ApiProperty({
    description: '에러 메시지 (성공 시 null)',
    example: null,
    required: false,
    nullable: true,
  })
  error?: string | null;
}

import { ApiProperty } from '@nestjs/swagger';
import { CoreOutput } from '../dto/core.output';

/**
 * 1. 페이지네이션 메타 정보 DTO
 * (페이지 번호, 총 개수 등 순수 정보만 담습니다)
 */
export class PaginationMeta {
  @ApiProperty({ example: 100, description: '전체 항목 수' })
  total: number;

  @ApiProperty({ example: 1, description: '현재 페이지' })
  page: number;

  @ApiProperty({ example: 10, description: '전체 페이지 수' })
  totalPages: number;

  @ApiProperty({ example: 10, description: '페이지당 항목 수' })
  limit: number;

  @ApiProperty({ example: true, description: '다음 페이지 존재 여부' })
  hasNext: boolean;
}

/**
 * 2. 페이지네이션 응답 DTO (Wrapper)
 * 실제 API가 반환하는 최종 객체입니다. (CoreOutput 상속)
 * {
 * ok: true,
 * data: [...],
 * meta: { ... }
 * }
 */
export class PaginationResponseDto<T> extends CoreOutput {
  // 제네릭 T는 Swagger가 직접 인식하지 못하므로,
  // 실제 Controller에서 @ApiOkResponse({ type: ... }) 등을 통해 구체화해야 합니다.
  data: T[];

  @ApiProperty({ type: PaginationMeta, description: '페이지네이션 정보' })
  meta: PaginationMeta;

  /**
   * 생성자: 데이터와 메타 정보를 받아 객체를 생성
   */
  constructor(data: T[], meta: PaginationMeta) {
    super();
    this.ok = true; // CoreOutput 필드
    this.error = null; // CoreOutput 필드
    this.data = data;
    this.meta = meta;
  }
}

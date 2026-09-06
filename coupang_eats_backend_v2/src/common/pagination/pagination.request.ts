import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 페이지네이션 기본값 상수
 */
export enum PaginationDefault {
  PAGE_DEFAULT = 1,
  LIMIT_DEFAULT = 10,
}

export class PaginationRequest {
  @ApiProperty({
    description: '페이지 번호',
    example: 1,
    required: false,
    default: PaginationDefault.PAGE_DEFAULT, // Swagger에 기본값 표시
    minimum: 1,
  })
  @IsOptional()
  @Min(1)
  @IsInt()
  @Type(() => Number)
  page: number = PaginationDefault.PAGE_DEFAULT;

  @ApiProperty({
    description: '페이지당 항목 수',
    example: 10,
    required: false,
    default: PaginationDefault.LIMIT_DEFAULT,
    minimum: 1,
  })
  @IsOptional()
  @Min(1)
  @IsInt()
  @Type(() => Number)
  limit: number = PaginationDefault.LIMIT_DEFAULT;

  /**
   * 다음 페이지 존재 여부 계산 메서드
   */
  getHasNext(totalCount: number): boolean {
    return this.page * this.limit < totalCount;
  }
}

import { Expose } from 'class-transformer';
import { PaginationBuilder } from './pagination.builder';

/**
 * 서비스가 반환하는 최종 페이지네이션 응답 클래스
 * 실제 데이터 리스트와 페이지네이션 정보를 포함한다.
 */
export class PaginationResponse<T> {
  total: number;
  list: Array<T>;
  page: number;
  limit: number;

  /**
   * PaginationBuilder가 제공한 데이터로 객체를 초기화한다.
   * @param paginationBuilder
   */
  constructor(paginationBuilder: PaginationBuilder<T>) {
    this.total = paginationBuilder._total;
    this.list = paginationBuilder._list;
    this.page = paginationBuilder._page;
    this.limit = paginationBuilder._limit;
  }

  /**
   * 전체 페이지 수를 계산하는 getter이다.
   */
  @Expose()
  get totalPages(): number {
    return Math.ceil(this.total / this.limit); // (전체 개수 / 페이지당 개수) 올림
  }

  /**
   * 다음 페이지 존재 여부를 계산하는 Getter이다.
   */
  @Expose()
  get hasNext(): boolean {
    return this.totalPages > this.page; // 전체 페이지 수가 현재 페이지보다 크면 true
  }
}

import { PaginationResponse } from './pagination.response';

/**
 * PaginationResponse 객체를 생성하기 위한 빌더 클래스이다.
 * 메서드 체이닝(method chaining)을 지원하여 가독성을 높인다.
 */
export class PaginationBuilder<T> {
  // 빌드에 필요한 데이터를 임시 저장하는 내부 속성F
  _list: T[];
  _page: number;
  _limit: number;
  _total: number;

  /**
   * 데이터 모록(배열)을 설정한다.
   * @param data DB에서 조회한 실제 데이터 배열(예: 유저 목록)
   * @returns
   */
  setData(data: T[]) {
    this._list = data;
    return this; // 메서드 체이닝을 위해 'this' 반환
  }

  /**
   * 현제 페이지 번호를 설정한다.
   * @param page 요청받은 페이지 번호
   * @returns
   */
  setPage(page: number) {
    this._page = page;
    return this;
  }

  /**
   * 페이지당 아이템 개수를 설정한다.
   * @param limit 요청받은 아이템 개수
   * @returns
   */
  setLimit(limit: number) {
    this._limit = limit;
    return this;
  }

  /**
   * 전체 데이터 개수를 설정한다.
   * @param total DB에서 조회한 전체 데이터 개수(count)
   * @returns
   */
  setTotalCount(total: number) {
    this._total = total;
    return this;
  }

  /**
   * 설정된 데이터를 바탕으로 최종 PaginationResponse 객체를 생성하여 반환한다.
   * @returns
   */
  build() {
    return new PaginationResponse(this); // PaginationResponse 생성자 호출
  }
}

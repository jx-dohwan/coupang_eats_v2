import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class RequestContextService {
  constructor(private readonly cls: ClsService) {}

  /**
   * 현재 요청의 고유 ID를 반환, 로그를 남길 때 이 ID를 함께 저장하면, 수많은 로그 속에서 특정 요청의 흐름만 필터링 해서 볼 수 있다.
   * @returns 
   */
  getRequestId(): string {
    return this.cls.getId();
  }
}

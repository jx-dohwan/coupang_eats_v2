import { Union } from '../../../common/type/common.interface'; 
import { FindOptionsRelations } from 'typeorm';

// 타입 T에서 대문자로 시작하는 속성을 제거한다. (주로 관계(relation)속성 제거용)
/**
 * [OmitUppercaseProps<T>]
 * 타입 T에서 '대문자'로 시작하는 속성(e.g., 'User', 'Posts')을 제거한다.
 * 용도: TypeORM 엔티티에서 순서 데이터 컬럼만 남길 때 사용된다.
 */
export type OmitUppercaseProps<T> = {
    // 키(K)가 대문자로 시작하면 'never'(제거), 아니면(소문자) 'K'(유지)
  [K in keyof T as K extends string
    ? K extends `${Uppercase<string>}${string}`
      ? never
      : K
    : K]: T[K];
};

// TypeORM 'relations' 옵션에 명시되지 않은 관계 속성을 타입 T에서 제거한다.
/**
 * [OmitNotJoinedProps<T,R>]
 * TypeORM 'relation' 옵션(R)에 명시된 타입 T에서 제거한다.
 * 용도: 쿼리 결과와 타입을 100% 일치시켜 안전성 확보
 */
export type OmitNotJoinedProps<T, R extends FindOptionsRelations<T>> = {
    // [1. 키 필터링]
    // 일반 속성(소문자)은 유지
    // 관계 속성(대문자)은 'relations' 옵션(R)에 *포함된 경우에만*유지
  [K in keyof T as K extends string
    ? K extends `${Uppercase<string>}${string}` // 관계 속성인가?
      ? K extends keyof R // relations(R)에 포함 되었는가?
        ? K // (Yes) 유지
        : never // (No) 제거
      : K // 일반 속성은 유지
    : K]: 
    // [2. 값 타입 매칭]
    // relations(R)에 포함된 키(K)의 타입을 결정한다.
    K extends keyof R 
    // (A) {Posts: true} (단순 조인): 중첩 관계 제거(OmitUppercaseProps)
    ? R[K] extends true
      ? T[K] extends (infer U)[]
        ? OmitUppercaseProps<U>[]
        : OmitUppercaseProps<T[K]>
        // (B) {Posts : {Comments:true}} (중첩 조인): 이 타입을 재귀적으로 적용
      : R[K] extends object
        ? T[K] extends (infer U)[]
          ? OmitNotJoinedProps<U, R[K]>[]
          : OmitNotJoinedProps<T[K], R[K]>
        : T[K]
        // (C) 일반 속성(id, name)등 원래 타입(T[K]) 유지
    : T[K];
};

// TypeORM 트랜잭션 잠금 모드에 사용할 상수 값을 정의한다.
/**
 * [LockMode 상수]
 * 트랜잭션 락(Lock) 모드를 위한 상수이다.
 * 'as const'로 객체를 읽기 전용으로 만들고, 값 타입을 리터럴('pessimistic_write')로 고정한다.
 * 용도: 문자열 하드코딩 대신 'LockMode.PessimisticWrite'를 사용하여 오타 방지
 */
export const LockMode = {
  PessimisticWrite: 'pessimistic_write',
} as const;

// LockMode 상수의 값('pessimistic_write')만 타입으로 사용하도록 제한한다.
/**
 * [LockMode 타입]
 * 위 LockMode 상수의 '값' ('pessimistic_write')들만 추출하여 유니온 타입으로 만든다.
 * 용도 함수 인자 타입을 LockMode로 지정하여 허용된 값만 받도록 강제
 */
export type LockMode = Union<typeof LockMode>;

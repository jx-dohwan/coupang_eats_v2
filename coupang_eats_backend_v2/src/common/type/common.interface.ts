/**
 * 'Mutable' 헬퍼 타입 1: 배열(Array)용
 * 배열의 각 요소 타입(T)에 대해 재귀적으로 'Mutable'을 적용하는 '변경 가능한 새 배열' 타입을 만든다.
 */
type MutableArray<T> = Array<Mutable<T>>;
/**
 * 'Mutable' 헬퍼 타입 2: 객체(Object)용
 * Mapped Type을 사용하여 객체 타입 T의 모든 속성(p)을 순회한다.
 */
type MutableObject<T> = {
  -readonly [P in keyof T]: Mutable<T[P]>;
};
/**
 * 타입 T를 받아, T와 T의 모든 중첩 속성/요소에서 'readonly'한정자를 재귀적으로 제거한 '완전히 변경 가능한' 새 타입을 반환한다.
 * 즉, readonly 읽기 전용 속성을 가진 객체나 배열을 모든 중첩 속성까지 포함하여 변경가능 하도록 타입을 변환시켜주는 역할을 한다.
 */
export type Mutable<T> =
  T extends Array<infer U>
    ? MutableArray<U>
    : T extends object
      ? MutableObject<T>
      : T;

// 복잡한 객체/배열 구조에서 모든 string | number | boolean 값 타입만 재귀적으로 추출해 하나로 합칩니다.
type ValueType = string | number | boolean;

export type Union<T> =
  T extends ReadonlyArray<infer U>
    ? Union<U>
    : T extends { [key: string]: infer U }
      ? Union<U>
      : T extends ValueType
        ? T
        : never;

export enum OrderStatus {
  Pending = 'Pending', // 주문 대기 (점주 수락 전)
  Cooking = 'Cooking', // 조리 중
  Cooked = 'Cooked', // 조리 완료 (기사 대기)
  PickedUp = 'PickedUp', // 배달 픽업 (배달 중)
  Delivered = 'Delivered', // 배달 완료
}

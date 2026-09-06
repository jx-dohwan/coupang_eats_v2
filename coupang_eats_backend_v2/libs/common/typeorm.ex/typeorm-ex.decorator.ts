import { SetMetadata } from "@nestjs/common";

// @CustomRepository 데코레이터가 사용할 고유 메타데이터 키(key)
export const TYPEORM_EX_CUSTOM_REPOSITORY = 'TYPEORM_EX_CUSTOM_REPOSITORY';

/**
 * 
 * 커스텀 리포지토리를 정의하는 데코레이터 팩토리 함수
 * 리포지토리 클래스가 어떤 엔티티를 다루는지 알려줌
 * @param entity  이 리포지토리가 담당할 엔티티 클래스
 * @returns 
 */
export function CustomRepository(entity: any): ClassDecorator {
    // 'TYPEORM_EX_CUSTOM_REPOSITORY' 키에 'entity' 값을 메타데이터로 저장
    // Nest.js가 나중에 이 메타데이터를 읽어 DI(의존성 주입)에 사용한다.
    return SetMetadata(TYPEORM_EX_CUSTOM_REPOSITORY, entity);
}
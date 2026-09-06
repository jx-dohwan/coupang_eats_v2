import { NotFoundException } from '@nestjs/common';
import {
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  In,
  QueryRunner,
  Repository,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { OmitNotJoinedProps, OmitUppercaseProps } from './typeorm.interface';
import { PaginationRequest } from '../../../common/pagination/pagination.request';
import { Mutable } from '../../../common/type/common.interface';
import { PaginationResponse } from '../../../common/pagination/pagination.response';
import { PaginationBuilder } from '../../../common/pagination/pagination.builder';

/**
 * [범용 TypeORM 레포지토리]
 * 1. TypeORM Repository를 상속받아 공통 로직을 처리한다.
 * 2. 'find' 계열 메서드의 반환 타입을 Type-Safe하게 만든다. (Omit... 타입 사용)
 * 3. '...OrThrow' 메서드를 제고앟여 조회 실패 시 404 예외 처리를 자동화한다.
 */
export class GenericTypeOrmRepository<
  T extends UuidEntity,
> extends Repository<T> {
  // 커스텀 레포지토리를 위한 기본 생성자
  constructor(
    target: EntityTarget<T>,
    manager: EntityManager,
    queryRunner?: QueryRunner,
  ) {
    super(target, manager, queryRunner);
  }

  /**
   * 공용 페이지네이션 헬퍼 메서드
   * @param pagination page, limit 정보를 담은 요청 DTO
   * @param findOptionsWhere TypeORM의 'where' 검색 조건 (Mutable<T>는 readonly 엔티티 타입에러 방지용)
   * @param orderOptions 정렬 조건
   * @param select 조회할 컬럼 지정
   * @returns  list와 total 등이 포함된 표준 응답 객체
   */
  async paginate(
    pagination: PaginationRequest,
    findOptionsWhere?:
      | FindOptionsWhere<Mutable<T>>
      | FindOptionsWhere<Mutable<T>>[],
    orderOptions?: FindOptionsOrder<T>,
    select?: FindOptionsSelect<T>,
  ): Promise<PaginationResponse<OmitUppercaseProps<T>>> {
    // 1. 요청된 DTO에서 page, limit 추출
    const { limit, page } = pagination;

    // 2. TypeORM의 findMany 옵션 객체 조립
    const options: FindManyOptions<T> = {
      take: limit, // take: 가져올 개수(limit)
      skip: (page - 1) * limit, // skip: 건너뛸 개수 (offset)
      // (as...) : Mutable<T> 타입을 TypeORM이 인식하는 Where 타입으로 강제 변환
      where: findOptionsWhere as FindOptionsWhere<T>[],
      order: orderOptions,
      select,
    };

    // 3. (핵심) findAndCount: 데이터 목록(data)과 전체 개수(total)를 한 번에 조회
    const [data, total] = await this.findAndCount(options);

    // 4. PaginationBuilder를 사용해 표준 응답 객체 생성 및 반환
    return new PaginationBuilder<T>()
      .setData(data)
      .setPage(page)
      .setLimit(limit)
      .setTotalCount(total)
      .build();
  }

  /**
   *
   * @param filters
   * @param findOptionsRelations
   * @param orderOptions
   * @param withDeleted
   * @returns
   *
   * [관계 포함 + Throw] 1개 조회 (Type-Safe, 404 예외)
   * 'relations' 옵션에 명시된 관계만 포함하며, 결과가 없으면 404 예외를 던진다.
   */
  async findOneWithOmitNotJoinedProps<R extends FindOptionsRelations<T>>(
    filters: FindOptionsWhere<T> | FindOptionsWhere<T>[],
    findOptionsRelations: R,
    orderOptions?: FindOptionsOrder<T>,
    withDeleted?: boolean,
  ): Promise<OmitNotJoinedProps<T, R> | null> {
    const findOption: FindOneOptions = {
      where: filters,
      relations: findOptionsRelations,
      order: orderOptions,
      withDeleted,
    };
    const res = await this.findOne(findOption);
    return res as OmitNotJoinedProps<T, R> | null;
  }

  /**
   *
   * @param filters
   * @param findOptionsRelations
   * @param orderOptions
   * @param withDeleted
   * @returns
   * [관계 포함 + Throw] 1개 조회(Type-Safe, 404 예외)
   * 'relations' 옵션에 명시된 관계만 포함하며, 결과가 없으면 404예외를 던진다.
   */
  async findOneWithOmitNotJoinedPropsOrThrow<R extends FindOptionsRelations<T>>(
    filters: FindOptionsWhere<T> | FindOptionsWhere<T>[],
    findOptionsRelations: R,
    orderOptions?: FindOptionsOrder<T>,
    withDeleted?: boolean,
  ): Promise<OmitNotJoinedProps<T, R>> {
    const findOption: FindOneOptions = {
      where: filters,
      relations: findOptionsRelations,
      order: orderOptions,
      withDeleted,
    };
    const res = await this.findOne(findOption);

    if (!res) {
      throw new NotFoundException('Not found');
    }

    return res as OmitNotJoinedProps<T, R>;
  }

  /**
   *
   * @param filters
   * @param findOptionsRelations
   * @param orderOptions
   * @param withDeleted
   * @returns
   *
   * [관계 포함] 여러 개 조회 (Type-Safe)
   * 'relations'옵션에 명시된 관계만 포함하는 정확한 타입의 배열을 반환한다.
   */
  async findManyWithOmitNotJoinedProps<
    R extends FindOptionsRelations<T> = FindOptionsRelations<T>,
  >(
    filters: FindOptionsWhere<T> | FindOptionsWhere<T>[],
    findOptionsRelations: R,
    orderOptions?: FindOptionsOrder<T>,
    withDeleted?: boolean,
  ): Promise<Array<OmitNotJoinedProps<T, R>>> {
    const findOption: FindManyOptions = {
      where: filters,
      relations: findOptionsRelations,
      order: orderOptions,
      withDeleted,
    };
    const res = await this.find(findOption);
    return res as Array<OmitNotJoinedProps<T, R>>;
  }

  /**
   *
   * @param filters
   * @param orderOptions
   * @returns
   *
   * [관계 제외] 1개 조회 (null 허용)
   * 관계(relation)속성이 타입에서 제거된 엔티티를 반환한다.
   */
  async findOneByFilters(
    filters: FindOptionsWhere<T>,
    orderOptions?: FindOptionsOrder<T>,
  ): Promise<OmitUppercaseProps<T> | null> {
    const findOption: FindOneOptions = {
      where: filters,
      order: orderOptions,
    };

    const res = await this.findOne(findOption);
    return res;
  }

  /**
   *
   * @returns
   *
   * [관계 제외] 모든 엔티티 조회
   * 관계 속성이 타입에서 제거된 엔티티 배열을 반환한다.
   */
  async findAll(): Promise<OmitUppercaseProps<T[]>> {
    const res = await this.find();
    return res;
  }

  /**
   *
   * @param filters
   * @param orderOptions
   * @returns
   * [관계 제외] 조건에 맞는 여러 엔티티 조회
   * 관계 속성이 타입에서 제거된 엔티티 배열을 반환한다.
   */
  async findMany(
    filters: FindOptionsWhere<T>,
    orderOptions?: FindOptionsOrder<T>,
  ): Promise<OmitUppercaseProps<T[]>> {
    const findOption: FindManyOptions = {
      where: filters,
      order: orderOptions,
    };
    const res = await this.find(findOption);
    return res;
  }

  /**
   *
   * @param filters
   * @param orderOptions
   * @returns
   * [관계 제외 + Throw] 1개 조회 (상세 404 예외)
   * 결과가 없으면 어떤 조건으로 실패했는지 상세한 404 예외를 던진다.
   */
  async findOneOrThrow(
    filters: Partial<T>,
    orderOptions?: FindOptionsOrder<T>,
  ): Promise<OmitUppercaseProps<T>> {
    const findOption: FindOneOptions = {
      where: filters,
      order: orderOptions,
    };
    const res = await this.findOne(findOption);

    if (!res) {
      // 조회 실패 시 상세 에러 메시지 생성
      const msgList: string[] = [];
      for (const [key, value] of Object.entries(filters)) {
        msgList.push(`${key}: ${value}`);
      }
      throw new NotFoundException(`don't exist ${msgList.join(', ')}`);
    }
    return res;
  }

  /**
   *
   * @param id
   * @returns
   * [관계 제외 + Throw] ID로 1개 조회(404예외)
   * ID로 조회하며, 결과가 없으면 404 예외를 던진다.
   */
  async findByIdOrThrow(id: string): Promise<OmitUppercaseProps<T>> {
    const findOption: FindOneOptions = { where: { id } };
    const res = await this.findOne(findOption);

    if (!res) {
      throw new NotFoundException(`don't exist ${id}`);
    }
    return res;
  }

  async findByIds(ids: string[]) {
    const findOption: FindManyOptions = { where: { id: In(ids) } };
    const res = await this.find(findOption);
    return res;
  }

  /**
   * [테스트용] 모든 데이터 삭제
   */
  async deleteAllForTest() {
    await this.delete({});
  }
}

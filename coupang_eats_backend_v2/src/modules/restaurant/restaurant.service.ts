import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RestaurantRepository } from './repository/restaurant.repository';
import { CategoryRepository } from '../category/repository/category.repository';
import { User } from '../../entities/user/user.entity';
import { Role } from '../../entities/user/user.interface';
import { PaginationRequest } from '../../common/pagination/pagination.request';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { CategoryEntity } from '../../entities/category/category.entity';
import { RestaurantEntity } from '../../entities/restaurant/restaurant.entity';
import { Transactional } from 'typeorm-transactional';

@Injectable()
export class RestaurantService {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  /**
   * 식당 생성 (점주 전용)
   */
  @Transactional()
  async createRestaurant(owner: User, dto: CreateRestaurantDto) {
    try {
      console.log('🔥 1. createRestaurant 진입');

      if (owner.role !== Role.OWNER) {
        throw new UnauthorizedException('Only owners can create restaurants');
      }

      console.log('🔥 2. Repo 확인:', !!this.restaurantRepository);
      // 리포지토리가 껍데기인지 확인하기 위해 manager 존재 여부 출력
      console.log('🔥 2-1. Repo Manager:', !!this.restaurantRepository.manager);

      const category = await this.categoryRepository.findOneByFilters({
        id: dto.categoryId,
      });

      if (!category) {
        throw new NotFoundException(`don't exist ${dto.categoryId}`);
      }

      const restaurant = dto.toEntity(owner.id);
      restaurant.category = category;

      console.log('🔥 3. 저장 시도 직전');

      // ✅ [중요] this.restaurantService가 아니라 this.restaurantRepository 여야 합니다.
      const result = await this.restaurantRepository.save(restaurant);

      console.log('🔥 4. 저장 성공');
      return result;
    } catch (error) {
      // 🚨 여기가 가장 중요합니다. 에러 내용을 눈으로 확인해야 합니다.
      console.error('❌ [FATAL ERROR LOG] -----------------------');
      console.error(error);
      console.error('--------------------------------------------');
      throw error;
    }
  }

  /**
   * 식당 정보 수정(점주 전용)
   */
  @Transactional()
  async updateRestaurant(
    owner: User,
    restaurantId: string,
    dto: UpdateRestaurantDto,
  ) {
    const restaurant =
      await this.restaurantRepository.findByIdOrThrow(restaurantId);

    if (restaurant.ownerId !== owner.id) {
      throw new ForbiddenException('You are not the owner of this restaurant');
    }

    if (dto.categoryId) {
      await this.categoryRepository.findByIdOrThrow(dto.categoryId);
    }

    const updated = this.restaurantRepository.create({
      ...restaurant,
      ...dto,
    });

    return this.restaurantRepository.save(updated);
  }

  /**
   * 내 식당 목록 조회 (점주 대시보드 용)
   */
  async getMyRestaurants(owner: User) {
    return this.restaurantRepository.findMany({ ownerId: owner.id });
  }

  /**
   * 전체 식당 목록 조회 (손님용 - 페이지네이션 & 카테고리 필터)
   */
  async getRestaurants(pagination: PaginationRequest, categoryId?: string) {
    // categoryId가 있으면 필터 조건에 추가, 없으면 빈 객체
    const filter = categoryId ? { categoryId } : {};

    return this.restaurantRepository.paginate(pagination, filter);
  }

  /**
   * 식당 상세 조회 (메뉴 포함)
   */
  async getRestaurantById(id: string) {
    try {
      return await this.restaurantRepository.findOneWithOmitNotJoinedPropsOrThrow(
        { id },
        { dishes: true, category: true },
      );
    } catch (e) {
      console.error('❌ [GET ERROR] :', e);
      throw e;
    }
  }
}

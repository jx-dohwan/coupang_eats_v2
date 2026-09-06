import { ForbiddenException, Injectable } from '@nestjs/common';
import { DishRepository } from './repository/dish.repository';
import { RestaurantRepository } from '../restaurant/repository/restaurant.repository';
import { CreateDishDto } from './dto/create-dish.dto';
import { User } from '../../entities/user/user.entity';
import { UpdateDishDto } from './dto/update-dish.dto';

@Injectable()
export class DishService {
  constructor(
    private readonly dishRepository: DishRepository,
    private readonly restaurantRepository: RestaurantRepository,
  ) {}

  /**
   * 메뉴 생성
   */
  async createDish(owner: User, restaurantId: string, dto: CreateDishDto) {
    // 1. 식당 찾기 (없으면 에러)
    const restaurant =
      await this.restaurantRepository.findByIdOrThrow(restaurantId);

    // 2. 소유권 확인 (본인 식당인지)
    if (restaurant.ownerId !== owner.id) {
      throw new ForbiddenException('You are not the owner of this restaurant');
    }

    // 3. 메뉴 생성 및 저장
    const dish = dto.toEntity(restaurantId);

    return this.dishRepository.save(dish);
  }

  /**
   * 메뉴 수정
   */
  async updateDish(
    owner: User,
    restaurantId: string,
    dishId: string,
    dto: UpdateDishDto,
  ) {
    // 1. 메뉴 조회, 식당 주인이 확인해야 하므로 restaurant 관계를 함께 로드
    const dish = await this.dishRepository.findOneWithOmitNotJoinedPropsOrThrow(
      { id: dishId, restaurantId }, // dishId와 restaurantId가 모두 일치하는지 확인
      { restaurant: true },
    );

    // 2. 소유권 확인
    if (dish.restaurant.ownerId !== owner.id) {
      throw new ForbiddenException('You cannot update this dish');
    }

    // 3. 엔티티 병합(기존dish + 수정된 dto), create로 객체를 병합하여 새 인스턴스를 반환
    const updateDish = this.dishRepository.create({
      ...dish,
      ...dto,
    });

    // 4. 저장
    return this.dishRepository.save(updateDish);
  }

  /**
   * 메뉴 삭제
   */
  async deleteDish(owner: User, dishId: string) {
    // 1. 메뉴와 식당 정보를 함께 조회(소유권 확인을 위해)
    const dish = await this.dishRepository.findOneWithOmitNotJoinedPropsOrThrow(
      { id: dishId },
      { restaurant: true },
    );

    // 2. 소유권 확인
    if (dish.restaurant.ownerId !== owner.id) {
      throw new ForbiddenException('You cannot delete this dish');
    }

    // 3. 삭제
    await this.dishRepository.softDelete(dishId);

    return { success: true };
  }
}

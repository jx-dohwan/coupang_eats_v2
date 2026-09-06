import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { DishOption } from '../../../entities/dish/dish.interface';
import { plainToInstance, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OrderItemEntity } from '../../../entities/order/order-item.entity';
import { DishEntity } from '../../../entities/dish/dish.entity';
import { User } from '../../../entities/user/user.entity';
import { RestaurantEntity } from '../../../entities/restaurant/restaurant.entity';
import { OrderEntity } from '../../../entities/order/order.entity';
import { OrderStatus } from '../../../common/type/common.interface';

export class CreateOrderItemDto {
  @ApiProperty({ description: '메뉴 ID (UUID)', example: 'dish-uuid-1234' })
  @IsString()
  dishId: string;

  @ApiProperty({
    description: '선택한 옵션 리스트',
    type: [DishOption],
    required: false,
  })
  @IsOptional()
  @IsArray()
  options?: DishOption[];

  toEntity(dish: DishEntity): OrderItemEntity {
    return plainToInstance(OrderItemEntity, {
      dish: dish, // 실제 Dish 연결 (Relation)
      dishName: dish.name, // 이름 박제 (Snapshot)
      options: this.options, // 옵션 박제 (Snapshot)
    });
  }
}

export class CreateOrderDto {
  @ApiProperty({
    description: '식당 ID (UUID)',
    example: 'restaurant-uuid-1234',
  })
  @IsString()
  restaurantId: string;

  @ApiProperty({
    description: '주문할 메뉴 목록',
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  toEntity(
    customer: User,
    restaurant: RestaurantEntity,
    total: number,
    items: OrderItemEntity[],
  ): OrderEntity {
    return plainToInstance(OrderEntity, {
      customer,
      restaurant,
      restaurantId: restaurant.id,
      total,
      items, // 위에서 만든 OrderItem 배열 연결
      status: OrderStatus.Pending, // 초기 상태 설정
    });
  }
}

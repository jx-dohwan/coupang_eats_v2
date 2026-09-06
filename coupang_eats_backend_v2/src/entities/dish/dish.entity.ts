import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { UuidEntity } from '../../core/database/typeorm/base.entity';
import { DishOption } from './dish.interface';
import { RestaurantEntity } from '../restaurant/restaurant.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('dish')
export class DishEntity extends UuidEntity {
  @ApiProperty({ description: '메뉴 이름' })
  @Column()
  name: string;

  @ApiProperty({ description: '가격' })
  @Column()
  price: number;

  @ApiProperty({ description: '사진', nullable: true })
  @Column({ nullable: true })
  photo: string;

  @ApiProperty({ description: '설명' })
  @Column()
  description: string;

  @ApiProperty({
    description: '메뉴 옵션(JSON)',
    type: [DishOption],
    nullable: true,
  })
  @Column({ type: 'json', nullable: true })
  options: DishOption[];

  // [수정] snake_case로 통일
  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, (restaurant) => restaurant.dishes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;
}

import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { UuidEntity } from '../../core/database/typeorm/base.entity';
import { CategoryEntity } from '../category/category.entity';
import { DishEntity } from '../dish/dish.entity';
import { User } from '../user/user.entity';
import { OrderEntity } from '../order/order.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('restaurant')
export class RestaurantEntity extends UuidEntity {
  @ApiProperty({ description: '식당 이름', example: '교촌치킨 강남점' })
  @Column()
  name: string;

  @ApiProperty({
    description: '커버 이미지 URL',
    example: 'https://img.url/cover.jpg',
  })
  @Column()
  coverImg: string;

  @ApiProperty({ description: '주소', example: '서울시 강남구 역삼동 123-4' })
  @Column()
  address: string;

  @ApiProperty({ description: '배달비', example: 3000 })
  @Column()
  deliveryFee: number;

  @ApiProperty({ description: '최소 주문 금액', example: 15000 })
  @Column()
  minimumPrice: number;

  @ApiProperty({ description: '프로모션 여부', example: false })
  @Column({ default: false })
  isPromoted: boolean;

  @ApiProperty({ description: '프로모션 종료일', nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  promotedUntil: Date;

  // [수정] DB 컬럼명 통일 (snake_case)
  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' }) // 위와 이름 일치시킴
  owner: User;

  // [수정] DB 컬럼명 통일 및 nullable 설정
  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ManyToOne(() => CategoryEntity, (category) => category.restaurants, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' }) // [치명적 오류 수정] @Column -> @JoinColumn
  category: CategoryEntity;

  @OneToMany(() => DishEntity, (dish) => dish.restaurant)
  dishes: DishEntity[];

  @OneToMany(() => OrderEntity, (order) => order.restaurant)
  orders: OrderEntity[];
}

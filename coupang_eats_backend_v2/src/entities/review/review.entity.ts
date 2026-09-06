import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { UuidEntity } from '../../core/database/typeorm/base.entity';
import { User } from '../user/user.entity';
import { RestaurantEntity } from '../restaurant/restaurant.entity';
import { OrderEntity } from '../order/order.entity'; 
import { ApiProperty } from '@nestjs/swagger';

@Entity('reviews')
export class ReviewEntity extends UuidEntity {
  @ApiProperty({ description: '평점 (1~5)', example: 5 })
  @Column({ type: 'int' })
  score: number;

  @ApiProperty({ description: '리뷰 내용', example: '정말 맛있어요!' })
  @Column()
  reviewText: string;

  @ApiProperty({
    description: '리뷰 이미지 URL 목록',
    type: [String],
    nullable: true,
  })
  @Column({ type: 'json', nullable: true })
  reviewImg: string[];

  // 1. 작성자 (Client)
  @Column({ name: 'client_id', nullable: true })
  clientId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: User;

  // 2. 식당 (Restaurant)
  @Column({ name: 'restaurant_id', nullable: true })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  // 3. 주문 (Order) - [추가] 1:1 관계가 적절함 (1주문 1리뷰)
  // 만약 DB 스키마에 order_id 컬럼이 없다면 추가해야 합니다.
  @OneToOne(() => OrderEntity, { nullable: true, onDelete: 'SET NULL' }) 
  @JoinColumn({ name: 'order_id' }) // 외래키 이름 지정
  order: OrderEntity;
  
  @Column({ name: 'order_id', nullable: true })
  orderId: string;
}
import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { UuidEntity } from '../../core/database/typeorm/base.entity';
import { User } from '../user/user.entity';
import { RestaurantEntity } from '../restaurant/restaurant.entity';
import { OrderEntity } from '../order/order.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('payment')
export class PaymentEntity extends UuidEntity {
  @ApiProperty({ description: 'PG사 거래 ID', example: 'imp_1234567890' })
  @Column({ name: 'transaction_id' })
  transactionId: string;

  // [수정] 아래 외래키들 모두 snake_case로 변경
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity)
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @ApiProperty({ description: '주문 ID', example: 'order-uuid-1234' })
  @Column({ name: 'order_id' })
  orderId: string;

  @OneToOne(() => OrderEntity)
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}

import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  JoinColumn,
  OneToMany, 
} from 'typeorm';
import { UuidEntity } from '../../core/database/typeorm/base.entity';
import { OrderStatus } from '../../common/type/common.interface';
import { User } from '../user/user.entity';
import { RestaurantEntity } from '../restaurant/restaurant.entity';
import { OrderItemEntity } from './order-item.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('order')
export class OrderEntity extends UuidEntity {
  @ApiProperty({ description: '총 주문 금액', example: 25000 })
  @Column({ type: 'int', nullable: true })
  total: number;

  @ApiProperty({ description: '총 주문 수량' })
  @Column({ type: 'int', nullable: true, name: 'totalCount' })
  totalCount: number;

  @ApiProperty({
    description: '주문 상태',
    enum: OrderStatus,
    example: OrderStatus.Pending,
  })
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.Pending })
  status: OrderStatus;

  // 1. 고객 (Customer)
  @Column({ name: 'customer_id', nullable: true }) // 명시적 컬럼 정의
  customerId: string;

  @ManyToOne(() => User, (user) => user.orders, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'customer_id' }) // 외래키 이름 고정
  customer: User;

  // 2. 배달 기사 (Driver)
  @Column({ name: 'driver_id', nullable: true }) // 명시적 컬럼 정의
  driverId: string;

  @ManyToOne(() => User, (user) => user.rides, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'driver_id' }) // 외래키 이름 고정
  driver: User;

  // 3. 식당 (Restaurant)
  @Column({ name: 'restaurant_id', nullable: true }) // 명시적 컬럼 정의
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, (restaurant) => restaurant.orders, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'restaurant_id' }) // 외래키 이름 고정
  restaurant: RestaurantEntity;

  // 4. 주문 항목 (ManyToMany는 JoinTable 사용하므로 기존 유지)
  @ApiProperty({ description: '주문 항목 리스트', type: [OrderItemEntity] })
  @OneToMany(() => OrderItemEntity, (orderItem) => orderItem.order, {
    eager: true,
    cascade: true, //  이 설정 덕분에 order.save() 시 items가 자동 저장됨
  })
  items: OrderItemEntity[];
}

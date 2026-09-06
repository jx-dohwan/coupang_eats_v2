import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { UuidEntity } from '../../core/database/typeorm/base.entity';
import { DishEntity } from '../dish/dish.entity';
import { DishOption } from '../dish/dish.interface';
import { ApiProperty } from '@nestjs/swagger';
import { OrderEntity } from './order.entity';

@Entity('order_item')
export class OrderItemEntity extends UuidEntity {
  @ManyToOne(() => DishEntity, { nullable: true, onDelete: 'SET NULL' })
  dish: DishEntity; // 원본 메뉴 연결

  @ApiProperty({
    description: '주문 메뉴 이름 (스냅샷)',
    example: '후라이드 치킨',
  })
  @Column({ nullable: true })
  dishName: string; // 주문 당시 메뉴 이름

  @ApiProperty({
    description: '선택한 옵션 (스냅샷)',
    type: [DishOption],
    nullable: true,
  })
  @Column({ type: 'json', nullable: true })
  options: DishOption[];

  @Column({ name: 'order_id', nullable: true })
  orderId: string;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}

import { Column, Entity, OneToMany } from 'typeorm';
import { UuidEntity } from '../../core/database/typeorm/base.entity';
import { Role } from './user.interface';
import { OrderEntity } from '../order/order.entity';
import { RestaurantEntity } from '../restaurant/restaurant.entity';

@Entity('user')
export class User extends UuidEntity {
  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  password: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'enum', enum: Role, nullable: false })
  role: Role;

  @Column({ type: 'boolean', default: false, nullable: false })
  verified: boolean;

  @OneToMany(() => RestaurantEntity, (restaurant) => restaurant.owner)
  restaurants: RestaurantEntity[];

  @OneToMany(() => OrderEntity, (order) => order.customer)
  orders: OrderEntity[];

  @OneToMany(() => OrderEntity, (order) => order.driver)
  rides: OrderEntity[];
}

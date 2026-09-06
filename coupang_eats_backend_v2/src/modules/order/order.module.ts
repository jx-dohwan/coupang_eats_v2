import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { DishModule } from '../dish/dish.module';
import { OrderCronService } from './order-cron.service';
import { EventsModule } from '../../events/events.module';
import { OrderRepositoryModule } from './repository/order-repository.module';
import { OrderItemRepositoryModule } from './repository/order-item-repository.module';

@Module({
  imports: [
    OrderRepositoryModule, 
    OrderItemRepositoryModule, 
    RestaurantModule,
    DishModule,
    EventsModule,
  ],
  controllers: [OrderController],

  providers: [OrderService, OrderCronService],

  exports: [OrderRepositoryModule],
})
export class OrderModule {}

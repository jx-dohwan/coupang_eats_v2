import { Module } from '@nestjs/common';
import { DishService } from './dish.service';
import { DishController } from './dish.controller';
import { DishRepositoryModule } from './repository/dish-repository.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { DishRepository } from './repository/dish.repository';

@Module({
  imports: [
    DishRepositoryModule, 
    RestaurantModule,
  ],
  controllers: [DishController],

  providers: [DishService],

  exports: [DishService, DishRepositoryModule],
})
export class DishModule {}

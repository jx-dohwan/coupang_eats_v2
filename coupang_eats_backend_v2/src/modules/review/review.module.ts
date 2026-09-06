import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { OrderModule } from '../order/order.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { ReviewRepositoryModule } from './repository/review-repository.module';

@Module({
  imports: [
    ReviewRepositoryModule,
    OrderModule,
    RestaurantModule,
  ],
  controllers: [ReviewController],

  providers: [ReviewService],
})
export class ReviewModule {}

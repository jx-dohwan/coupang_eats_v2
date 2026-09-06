import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { CoreModule } from './core/core.module';
import { RequestLoggerMiddleware } from './core/middleware/requestLogger.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { CategoryModule } from './modules/category/category.module';
import { DishModule } from './modules/dish/dish.module';
import { RestaurantModule } from './modules/restaurant/restaurant.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReviewModule } from './modules/review/review.module';
import { AppController } from './app.controller';
import { UploadModule } from './modules/upload/upload.module';

const applicationModules = [
  UserModule,
  AuthModule,
  CategoryModule,
  DishModule,
  RestaurantModule,
  OrderModule,
  PaymentModule,
  ReviewModule,
  UploadModule
];

@Module({
  imports: [CoreModule, ...applicationModules],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}

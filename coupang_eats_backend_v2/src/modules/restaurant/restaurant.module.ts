import { Module } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { RestaurantController } from './restaurant.controller';
import { RestaurantRepositoryModule } from './repository/restaurant-repository.module';
import { CategoryRepositoryModule } from '../category/repository/category-repository.module';
import { AwsModule } from '../../core/aws/aws.module';

@Module({
  imports: [
    // 1. 여기서 RepositoryModule을 import 하면,
    // 내부적으로 TypeOrmExModule이 동작하여 '진짜 리포지토리'를 공급해줍니다.
    RestaurantRepositoryModule,
    CategoryRepositoryModule,
    AwsModule,
  ],
  controllers: [RestaurantController],

  // ⚠️ [절대 주의] 여기에 'RestaurantRepository'를 넣으면 안 됩니다!
  // 넣는 순간 TypeOrmExModule이 만든 '진짜'를 덮어쓰고 '가짜(빈 껍데기)'가 주입됩니다.
  providers: [RestaurantService],

  // 다른 모듈에서 이 모듈을 쓸 때 Repository도 쓸 수 있게 RepositoryModule 자체를 export 합니다.
  exports: [RestaurantService, RestaurantRepositoryModule],
})
export class RestaurantModule {}

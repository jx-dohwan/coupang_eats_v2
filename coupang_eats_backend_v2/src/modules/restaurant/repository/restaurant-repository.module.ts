import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '../../../../libs/common/typeorm.ex/typeorm-ex.module';
import { RestaurantRepository } from './restaurant.repository';

@Module({
  imports: [TypeOrmExModule.forCustomRepository([RestaurantRepository])],
  exports: [TypeOrmExModule.forCustomRepository([RestaurantRepository])],
})
export class RestaurantRepositoryModule {}

import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '../../../../libs/common/typeorm.ex/typeorm-ex.module';
import { DishRepository } from './dish.repository';

@Module({
  imports: [TypeOrmExModule.forCustomRepository([DishRepository])],
  exports: [TypeOrmExModule.forCustomRepository([DishRepository])],
})
export class DishRepositoryModule {}

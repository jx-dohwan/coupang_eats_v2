import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '../../../../libs/common/typeorm.ex/typeorm-ex.module';
import { OrderRepository } from './order.repository';

@Module({
  imports: [TypeOrmExModule.forCustomRepository([OrderRepository])],
  exports: [TypeOrmExModule.forCustomRepository([OrderRepository])],
})
export class OrderRepositoryModule {}

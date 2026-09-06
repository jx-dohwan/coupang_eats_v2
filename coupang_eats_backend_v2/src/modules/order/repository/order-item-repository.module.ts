import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '../../../../libs/common/typeorm.ex/typeorm-ex.module';
import { OrderItemRepository } from './order-item.repository';

@Module({
  imports: [TypeOrmExModule.forCustomRepository([OrderItemRepository])],
  exports: [TypeOrmExModule.forCustomRepository([OrderItemRepository])],
})
export class OrderItemRepositoryModule {}

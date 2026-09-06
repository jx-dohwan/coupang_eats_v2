import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '../../../../libs/common/typeorm.ex/typeorm-ex.module';
import { PaymentRepository } from './payment.repository';

@Module({
  imports: [TypeOrmExModule.forCustomRepository([PaymentRepository])],
  exports: [TypeOrmExModule.forCustomRepository([PaymentRepository])],
})
export class PaymentRepositoryModule {}

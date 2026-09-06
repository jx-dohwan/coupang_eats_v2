import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { OrderModule } from '../order/order.module';
import { PaymentRepositoryModule } from './repository/payment-repository.module';

@Module({
  imports: [
    PaymentRepositoryModule, 
    OrderModule,
  ],
  controllers: [PaymentController],

  providers: [PaymentService],
})
export class PaymentModule {}

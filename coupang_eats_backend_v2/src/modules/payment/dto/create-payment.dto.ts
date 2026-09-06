import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { User } from '../../../entities/user/user.entity';
import { OrderEntity } from '../../../entities/order/order.entity';
import { PaymentEntity } from '../../../entities/payment/payment.entity';
import { plainToInstance } from 'class-transformer';

export class CreatePaymentDto {
  @ApiProperty({ description: 'PG사 거래 ID', example: 'imp_1234567890' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: '주문 ID', example: 'order-uuid-1234' })
  @IsString()
  orderId: string;

  toEntity(user: User, order: OrderEntity): PaymentEntity {
    const entity = plainToInstance(PaymentEntity, this);

    // 관계 및 데이터 설정
    entity.user = user;
    entity.order = order;
    entity.restaurantId = order.restaurantId;

    return entity;
  }
}

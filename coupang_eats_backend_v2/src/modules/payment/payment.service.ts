import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentRepository } from './repository/payment.repository';
import { OrderRepository } from '../order/repository/order.repository';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { User } from '../../entities/user/user.entity';

@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  /**
   * 결제
   * @param user
   * @param dto
   * @returns
   */
  async processPayment(user: User, dto: CreatePaymentDto) {
    // 1. 주문 조회
    const order = await this.orderRepository.findByIdOrThrow(dto.orderId);

    // 2. 본인 주문 확인
    if (order.customerId !== user.id) {
      throw new BadRequestException('You cannot pay for this order.');
    }

    // 3. 중복 결제 방지
    const existingPayment = await this.paymentRepository.findOneByFilters({
      orderId: order.id,
    });
    if (existingPayment) {
      throw new BadRequestException('Order is already paid.');
    }

    // 4. 결제 저장
    const payment = dto.toEntity(user, order);

    return this.paymentRepository.save(payment);
  }
}

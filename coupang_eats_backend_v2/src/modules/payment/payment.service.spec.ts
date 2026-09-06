import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PaymentRepository } from './repository/payment.repository';
import { OrderRepository } from '../order/repository/order.repository';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { User } from '../../entities/user/user.entity';
import { OrderEntity } from '../../entities/order/order.entity';
import { PaymentEntity } from '../../entities/payment/payment.entity';

// 1. Mock Repository 정의
const mockPaymentRepository = {
  save: jest.fn(),
  findOneByFilters: jest.fn(),
};
const mockOrderRepository = {
  findByIdOrThrow: jest.fn(),
};

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: typeof mockPaymentRepository;
  let orderRepository: typeof mockOrderRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PaymentRepository, useValue: mockPaymentRepository },
        { provide: OrderRepository, useValue: mockOrderRepository },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepository = module.get(PaymentRepository);
    orderRepository = module.get(OrderRepository);

    jest.clearAllMocks();
  });

  describe('processPayment', () => {
    const user = { id: 'user-1' } as User;
    const otherUser = { id: 'user-2' } as User;
    const orderId = 'order-1';

    // DTO Mocking (toEntity 포함)
    const createDto = {
      transactionId: 'imp_12345',
      orderId: orderId,
      toEntity: jest.fn(),
    } as unknown as CreatePaymentDto;

    it('본인 주문이고 중복 결제가 아니면 결제가 성공해야 한다', async () => {
      // Arrange
      const order = {
        id: orderId,
        customerId: user.id,
        restaurantId: 'res-1',
      } as OrderEntity;
      const paymentEntity = { id: 'pay-1' } as PaymentEntity;

      orderRepository.findByIdOrThrow.mockResolvedValue(order);
      paymentRepository.findOneByFilters.mockResolvedValue(null); // 중복 없음
      (createDto.toEntity as jest.Mock).mockReturnValue(paymentEntity);
      paymentRepository.save.mockResolvedValue(paymentEntity);

      // Act
      const result = await service.processPayment(user, createDto);

      // Assert
      expect(orderRepository.findByIdOrThrow).toHaveBeenCalledWith(orderId);
      expect(paymentRepository.findOneByFilters).toHaveBeenCalledWith({
        orderId: order.id,
      });
      expect(createDto.toEntity).toHaveBeenCalledWith(user, order); // toEntity 호출 검증
      expect(paymentRepository.save).toHaveBeenCalledWith(paymentEntity);
      expect(result).toEqual(paymentEntity);
    });

    it('본인 주문이 아니면 BadRequestException을 던져야 한다', async () => {
      // Arrange (주문자는 user-1인데, 요청자는 otherUser(user-2))
      const order = { id: orderId, customerId: user.id } as OrderEntity;
      orderRepository.findByIdOrThrow.mockResolvedValue(order);

      // Act & Assert
      await expect(
        service.processPayment(otherUser, createDto),
      ).rejects.toThrow(BadRequestException);

      // 검증: 중복 체크나 저장은 실행되면 안 됨
      expect(paymentRepository.findOneByFilters).not.toHaveBeenCalled();
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });

    it('이미 결제된 주문이면 BadRequestException을 던져야 한다', async () => {
      // Arrange
      const order = { id: orderId, customerId: user.id } as OrderEntity;
      const existingPayment = { id: 'pay-existing' } as PaymentEntity;

      orderRepository.findByIdOrThrow.mockResolvedValue(order);
      paymentRepository.findOneByFilters.mockResolvedValue(existingPayment); // 이미 존재함

      // Act & Assert
      await expect(service.processPayment(user, createDto)).rejects.toThrow(
        BadRequestException,
      );

      // 검증: 저장은 실행되면 안 됨
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });

    it('주문이 존재하지 않으면 NotFoundException(Repo)이 전파되어야 한다', async () => {
      orderRepository.findByIdOrThrow.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.processPayment(user, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

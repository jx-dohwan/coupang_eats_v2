import { Test, TestingModule } from '@nestjs/testing';
import { OrderCronService } from './order-cron.service';
import { OrderRepository } from './repository/order.repository';
import { OrderStatus } from '../../common/type/common.interface';
import { LessThan } from 'typeorm';

// 1. Mock Repository 정의
const mockOrderRepository = {
  delete: jest.fn(),
};

describe('OrderCronService', () => {
  let service: OrderCronService;
  let repository: typeof mockOrderRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCronService,
        {
          provide: OrderRepository,
          useValue: mockOrderRepository,
        },
      ],
    }).compile();

    service = module.get<OrderCronService>(OrderCronService);
    repository = module.get(OrderRepository);

    jest.clearAllMocks();

    // 2. 시간 고정 (Time Mocking)
    // 테스트가 실행되는 "현재 시간"을 2024년 1월 2일 새벽 4시로 고정합니다.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-02T04:00:00.000Z'));
  });

  afterEach(() => {
    // 테스트 종료 후 시간 설정을 원래대로 복구
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleCron', () => {
    it('24시간이 지난(어제보다 이전인) Pending 주문을 삭제해야 한다', async () => {
      // Arrange
      // 현재 시간이 1월 2일이므로, 어제는 1월 1일이어야 합니다.
      const expectedDate = new Date('2024-01-01T04:00:00.000Z');

      // delete 메서드가 { affected: 5 }를 반환한다고 가정
      repository.delete.mockResolvedValue({ affected: 5 });

      // Act
      await service.handleCron();

      // Assert
      expect(repository.delete).toHaveBeenCalledWith({
        status: OrderStatus.Pending,
        createdAt: LessThan(expectedDate), // 계산된 날짜와 TypeORM 연산자 검증
      });
    });
  });
});

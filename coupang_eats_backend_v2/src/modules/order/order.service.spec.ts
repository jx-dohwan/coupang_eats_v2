import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { OrderRepository } from './repository/order.repository';
import { OrderItemRepository } from './repository/order-item.repository';
import { RestaurantRepository } from '../restaurant/repository/restaurant.repository';
import { DishRepository } from '../dish/repository/dish.repository';
import { EventsGateway } from '../../events/events.gateway';
import { DataSource } from 'typeorm';
import { initializeTransactionalContext } from 'typeorm-transactional'; // ✅ 필수
import { User } from '../../entities/user/user.entity';
import { OrderStatus } from '../../common/type/common.interface';
import { Role } from '../../entities/user/user.interface';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

// 트랜잭션 Mocking: runOnTransactionCommit은 즉시 콜백을 실행하도록 설정
jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
  initializeTransactionalContext: jest.fn(),
  runOnTransactionCommit: jest.fn((cb) => cb()),
}));

describe('OrderService', () => {
  let service: OrderService;
  let orderRepo: jest.Mocked<OrderRepository>;
  let orderItemRepo: jest.Mocked<OrderItemRepository>;
  let restaurantRepo: jest.Mocked<RestaurantRepository>;
  let dishRepo: jest.Mocked<DishRepository>;
  let eventsGateway: any;

  beforeAll(() => {
    // 트랜잭션 컨텍스트 초기화 (Mocking 되었지만 안전장치)
    try {
      initializeTransactionalContext();
    } catch (e) {}
  });

  beforeEach(async () => {
    // 리포지토리 및 게이트웨이 Mocking
    const mockOrderRepo = {
      save: jest.fn(),
      findManyWithOmitNotJoinedProps: jest.fn(),
      find: jest.fn(),
      findOneWithOmitNotJoinedPropsOrThrow: jest.fn(),
    };
    const mockOrderItemRepo = {
      create: jest.fn(),
    };
    const mockRestaurantRepo = {
      findByIdOrThrow: jest.fn(),
      findMany: jest.fn(),
    };
    const mockDishRepo = {
      findManyWithOmitNotJoinedProps: jest.fn(),
    };
    const mockEventsGateway = {
      server: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn().mockReturnThis(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: DataSource, useValue: {} },
        { provide: OrderRepository, useValue: mockOrderRepo },
        { provide: OrderItemRepository, useValue: mockOrderItemRepo },
        { provide: RestaurantRepository, useValue: mockRestaurantRepo },
        { provide: DishRepository, useValue: mockDishRepo },
        { provide: EventsGateway, useValue: mockEventsGateway },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepo = module.get(OrderRepository);
    orderItemRepo = module.get(OrderItemRepository);
    restaurantRepo = module.get(RestaurantRepository);
    dishRepo = module.get(DishRepository);
    eventsGateway = module.get(EventsGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =====================================================
  // 1. 주문 생성 테스트 (createOrder)
  // =====================================================
  describe('createOrder', () => {
    const customer = { id: 'cust-1' } as User;
    const dto: any = {
      restaurantId: 'rest-1',
      items: [
        { dishId: 'dish-1', options: [{ name: 'Spicy', extra: 500 }] },
      ],
      toEntity: jest.fn().mockReturnValue({ id: 'order-1', total: 11500 }),
    };

    it('주문이 정상적으로 생성되고 소켓 알림이 전송되어야 한다', async () => {
      // Mock Returns
      restaurantRepo.findByIdOrThrow.mockResolvedValue({
        id: 'rest-1',
        ownerId: 'owner-1',
        deliveryFee: 1000,
      } as any);
      dishRepo.findManyWithOmitNotJoinedProps.mockResolvedValue([
        {
          id: 'dish-1',
          price: 10000,
          options: [{ name: 'Spicy', extra: 500 }],
        } as any,
      ]);
      // toEntity Mock (OrderItem)
      dto.items[0].toEntity = jest.fn().mockReturnValue({}); 
      orderItemRepo.create.mockReturnValue({} as any);
      orderRepo.save.mockResolvedValue({ id: 'order-1', total: 11500 } as any);

      const result = await service.createOrder(customer, dto);

      expect(orderRepo.save).toHaveBeenCalled();
      expect(eventsGateway.server.to).toHaveBeenCalledWith('Owner:owner-1');
      expect(eventsGateway.server.emit).toHaveBeenCalledWith(
        'newPendingOrder',
        expect.anything(),
      );
      expect(result.id).toBe('order-1');
    });

    it('존재하지 않는 메뉴를 주문하면 NotFoundException을 던져야 한다', async () => {
      restaurantRepo.findByIdOrThrow.mockResolvedValue({} as any);
      dishRepo.findManyWithOmitNotJoinedProps.mockResolvedValue([]); // 메뉴 없음

      await expect(service.createOrder(customer, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =====================================================
  // 2. 주문 목록 조회 (getOrders)
  // =====================================================
  describe('getOrders', () => {
    it('손님(Client)은 본인의 주문 목록을 조회한다', async () => {
      const user = { id: 'cust-1', role: Role.CLIENT } as User;
      orderRepo.findManyWithOmitNotJoinedProps.mockResolvedValue([]);

      await service.getOrders(user);
      expect(orderRepo.findManyWithOmitNotJoinedProps).toHaveBeenCalledWith(
        { customer: { id: user.id } },
        expect.anything(),
        expect.anything(),
      );
    });

    it('점주(Owner)는 본인 식당의 주문 목록을 조회한다', async () => {
      const user = { id: 'owner-1', role: Role.OWNER } as User;
      restaurantRepo.findMany.mockResolvedValue([{ id: 'rest-1' }] as any);
      orderRepo.find.mockResolvedValue([]);

      await service.getOrders(user);
      expect(restaurantRepo.findMany).toHaveBeenCalledWith({ ownerId: user.id });
      expect(orderRepo.find).toHaveBeenCalled();
    });
  });

  // =====================================================
  // 3. 주문 상세 조회 (getOrderById)
  // =====================================================
  describe('getOrderById', () => {
    it('타인의 주문을 조회하면 ForbiddenException을 던져야 한다 (Client)', async () => {
      const user = { id: 'hacker', role: Role.CLIENT } as User;
      orderRepo.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue({
        id: 'order-1',
        customerId: 'victim',
      } as any);

      await expect(service.getOrderById(user, 'order-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('본인의 주문은 정상적으로 조회되어야 한다', async () => {
      const user = { id: 'me', role: Role.CLIENT } as User;
      const order = { id: 'order-1', customerId: 'me' };
      orderRepo.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue(order as any);

      const result = await service.getOrderById(user, 'order-1');
      expect(result).toEqual(order);
    });
  });

  // =====================================================
  // 4. 주문 상태 변경 (editOrderStatus)
  // =====================================================
  describe('editOrderStatus', () => {
    it('점주가 본인 식당 주문 상태를 변경하면 성공해야 한다', async () => {
      const user = { id: 'owner-1', role: Role.OWNER } as User;
      const order = {
        id: 'order-1',
        status: OrderStatus.Pending,
        restaurant: { ownerId: 'owner-1' },
      };
      orderRepo.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue(order as any);
      orderRepo.save.mockResolvedValue({ ...order, status: OrderStatus.Cooking } as any);

      await service.editOrderStatus(user, 'order-1', { status: OrderStatus.Cooking });

      expect(orderRepo.save).toHaveBeenCalled();
      expect(eventsGateway.server.emit).toHaveBeenCalledWith(
        'orderUpdate',
        expect.anything(),
      );
    });

    it('손님은 주문 상태를 변경할 수 없다', async () => {
      const user = { role: Role.CLIENT } as User;
      orderRepo.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue({} as any);

      await expect(
        service.editOrderStatus(user, 'order-1', { status: OrderStatus.Cooking }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
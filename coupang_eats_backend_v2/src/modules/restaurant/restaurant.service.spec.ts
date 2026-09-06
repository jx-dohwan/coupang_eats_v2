import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantService } from './restaurant.service';
import { DataSource } from 'typeorm';
import { RestaurantRepository } from './repository/restaurant.repository';
import { CategoryRepository } from '../category/repository/category.repository';
import { User } from '../../entities/user/user.entity';
import { Role } from '../../entities/user/user.interface';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';

// ✅ [핵심 수정] typeorm-transactional 모킹
// @Transactional 데코레이터가 붙은 메서드를 실행할 때, 아무런 동작도 하지 않고 원래 메서드를 그대로 실행하도록 만듭니다.
jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
  initializeTransactionalContext: jest.fn(),
  addTransactionalDataSource: jest.fn(),
}));

describe('RestaurantService', () => {
  let service: RestaurantService;
  let restaurantRepo: jest.Mocked<RestaurantRepository>;
  let categoryRepo: jest.Mocked<CategoryRepository>;

  beforeEach(async () => {
    // 리포지토리 모든 메서드 Mocking
    const mockRestaurantRepo = {
      save: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findByIdOrThrow: jest.fn(),
      paginate: jest.fn(),
      findOneWithOmitNotJoinedPropsOrThrow: jest.fn(),
      manager: {},
    };
    const mockCategoryRepo = {
      findOneByFilters: jest.fn(),
      findByIdOrThrow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantService,
        // Transactional 데코레이터가 DataSource를 가로채므로 빈 객체 주입
        { provide: DataSource, useValue: {} },
        { provide: RestaurantRepository, useValue: mockRestaurantRepo },
        { provide: CategoryRepository, useValue: mockCategoryRepo },
      ],
    }).compile();

    service = module.get<RestaurantService>(RestaurantService);
    restaurantRepo = module.get(RestaurantRepository);
    categoryRepo = module.get(CategoryRepository);
  });

  describe('createRestaurant', () => {
    const owner = { id: 'user-1', role: Role.OWNER } as User;
    const dto: any = {
      name: 'Test Rest',
      categoryId: 'cat-1',
      toEntity: jest.fn().mockReturnValue({ name: 'Test Rest' }),
    };

    it('점주가 식당을 생성하면 성공해야 한다', async () => {
      categoryRepo.findOneByFilters.mockResolvedValue({ id: 'cat-1' } as any);
      restaurantRepo.save.mockResolvedValue({ id: 'rest-1', ...dto } as any);

      const result = await service.createRestaurant(owner, dto);

      expect(categoryRepo.findOneByFilters).toHaveBeenCalled();
      expect(restaurantRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('rest-1');
    });

    it('점주가 아니면 UnauthorizedException을 던져야 한다', async () => {
      const client = { id: 'user-2', role: Role.CLIENT } as User;
      await expect(service.createRestaurant(client, dto)).rejects.toThrow(UnauthorizedException);
    });

    it('카테고리가 존재하지 않으면 NotFoundException을 던져야 한다', async () => {
      categoryRepo.findOneByFilters.mockResolvedValue(null);
      await expect(service.createRestaurant(owner, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRestaurant', () => {
    const owner = { id: 'owner-1' } as User;
    const restaurantId = 'rest-1';
    const existingRestaurant = { id: restaurantId, ownerId: 'owner-1' } as any;
    const updateDto = { name: 'Updated Name', categoryId: 'cat-2' };

    it('본인 소유의 식당을 수정하면 성공해야 한다', async () => {
      restaurantRepo.findByIdOrThrow.mockResolvedValue(existingRestaurant);
      categoryRepo.findByIdOrThrow.mockResolvedValue({ id: 'cat-2' } as any);
      restaurantRepo.create.mockReturnValue({ ...existingRestaurant, ...updateDto });
      restaurantRepo.save.mockResolvedValue({ ...existingRestaurant, ...updateDto });

      const result = await service.updateRestaurant(owner, restaurantId, updateDto);

      expect(result.name).toBe('Updated Name');
      expect(restaurantRepo.save).toHaveBeenCalled();
    });

    it('식당 주인이 아니면 ForbiddenException을 던져야 한다', async () => {
      const otherUser = { id: 'other-user' } as User;
      restaurantRepo.findByIdOrThrow.mockResolvedValue(existingRestaurant);
      await expect(service.updateRestaurant(otherUser, restaurantId, updateDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMyRestaurants', () => {
    it('점주의 식당 리스트를 반환해야 한다', async () => {
      const owner = { id: 'owner-1' } as User;
      restaurantRepo.findMany.mockResolvedValue([{ id: 'rest-1' }] as any);
      const result = await service.getMyRestaurants(owner);
      expect(restaurantRepo.findMany).toHaveBeenCalledWith({ ownerId: owner.id });
      expect(result).toHaveLength(1);
    });
  });

  describe('getRestaurants', () => {
    // as any 사용으로 타입 문제 해결
    const pagination = { page: 1, limit: 10 } as any;

    it('카테고리 필터 없이 조회하면 전체 페이징 결과를 반환해야 한다', async () => {
      await service.getRestaurants(pagination);
      expect(restaurantRepo.paginate).toHaveBeenCalledWith(pagination, {});
    });

    it('카테고리 필터와 함께 조회하면 해당 조건으로 페이징해야 한다', async () => {
      const catId = 'cat-1';
      await service.getRestaurants(pagination, catId);
      expect(restaurantRepo.paginate).toHaveBeenCalledWith(pagination, { categoryId: catId });
    });
  });

  describe('getRestaurantById', () => {
    it('식당 상세 정보(관계 포함)를 반환해야 한다', async () => {
      const restId = 'rest-1';
      restaurantRepo.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue({ id: restId, name: 'Detail' } as any);
      const result = await service.getRestaurantById(restId);
      expect(restaurantRepo.findOneWithOmitNotJoinedPropsOrThrow).toHaveBeenCalledWith(
        { id: restId },
        { dishes: true, category: true }
      );
      expect(result.name).toBe('Detail');
    });

    it('조회 실패 시 에러를 던져야 한다', async () => {
      restaurantRepo.findOneWithOmitNotJoinedPropsOrThrow.mockRejectedValue(new Error('DB Error'));
      await expect(service.getRestaurantById('wrong-id')).rejects.toThrow('DB Error');
    });
  });
});
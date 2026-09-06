import { Test, TestingModule } from '@nestjs/testing';
import { ReviewService } from './review.service';
import { ReviewRepository } from './repository/review.repository';
import { OrderRepository } from '../order/repository/order.repository';
import { RestaurantRepository } from '../restaurant/repository/restaurant.repository';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { User } from '../../entities/user/user.entity';
import { OrderStatus } from '../../common/type/common.interface';
import { OrderEntity } from '../../entities/order/order.entity';
import { RestaurantEntity } from '../../entities/restaurant/restaurant.entity';
import { ReviewEntity } from '../../entities/review/review.entity';

describe('ReviewService', () => {
  let service: ReviewService;
  let reviewRepository: any;
  let orderRepository: any;
  let restaurantRepository: any;

  beforeEach(async () => {
    // Mock Repository 정의 (매번 초기화)
    const mockReviewRepository = {
      save: jest.fn(),
      create: jest.fn(),
      findOneByFilters: jest.fn(),
      findOneWithOmitNotJoinedPropsOrThrow: jest.fn(),
      softDelete: jest.fn(),
    };
    const mockOrderRepository = {
      findOneWithOmitNotJoinedPropsOrThrow: jest.fn(),
    };
    const mockRestaurantRepository = {
      findByIdOrThrow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: ReviewRepository, useValue: mockReviewRepository },
        { provide: OrderRepository, useValue: mockOrderRepository },
        { provide: RestaurantRepository, useValue: mockRestaurantRepository },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    reviewRepository = module.get(ReviewRepository);
    orderRepository = module.get(OrderRepository);
    restaurantRepository = module.get(RestaurantRepository);
  });

  describe('createReview', () => {
    const user = { id: 'user-1' } as User;
    const orderId = 'order-1';
    const restaurantId = 'res-1';

    const createDto = {
      orderId,
      restaurantId,
      score: 5,
      reviewText: 'Great!',
      toEntity: jest.fn(), // DTO 메서드 Mocking
    } as unknown as CreateReviewDto;

    it('모든 조건이 충족되고 중복 리뷰가 없으면 리뷰가 생성되어야 한다', async () => {
      // Arrange
      const restaurant = { id: restaurantId } as RestaurantEntity;
      const order = {
        id: orderId,
        customerId: user.id,
        restaurant: restaurant,
        status: OrderStatus.Delivered,
      } as OrderEntity;

      const reviewEntity = { id: 'review-1', score: 5 } as ReviewEntity;

      // Mock Setup
      orderRepository.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue(order);
      reviewRepository.findOneByFilters.mockResolvedValue(null); // 중복 없음
      (createDto.toEntity as jest.Mock).mockReturnValue(reviewEntity);
      reviewRepository.save.mockResolvedValue(reviewEntity);

      // Act
      const result = await service.createReview(user, createDto);

      // Assert
      // 1. 주문 조회 확인
      expect(orderRepository.findOneWithOmitNotJoinedPropsOrThrow).toHaveBeenCalledWith(
        { id: orderId },
        { restaurant: true },
      );

      // 2. [수정] 중복 체크 호출 확인 (orderId 필드 사용)
      expect(reviewRepository.findOneByFilters).toHaveBeenCalledWith({
        orderId: orderId,
      });

      // 3. [수정] toEntity 호출 시 3번째 인자(order) 확인
      expect(createDto.toEntity).toHaveBeenCalledWith(user, restaurant, order);
      
      // 4. 저장 확인
      expect(reviewRepository.save).toHaveBeenCalledWith(reviewEntity);
      expect(result).toEqual(reviewEntity);
    });

    it('이미 해당 주문에 대한 리뷰가 존재하면 ConflictException을 던져야 한다', async () => {
      const order = {
        id: orderId,
        customerId: user.id,
        restaurant: { id: restaurantId },
        status: OrderStatus.Delivered,
      } as OrderEntity;

      orderRepository.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue(order);
      reviewRepository.findOneByFilters.mockResolvedValue({ id: 'existing' }); // 중복 존재

      await expect(service.createReview(user, createDto)).rejects.toThrow(ConflictException);
      expect(reviewRepository.save).not.toHaveBeenCalled();
    });

    it('본인의 주문이 아니면 BadRequestException을 던져야 한다', async () => {
      const order = {
        id: orderId,
        customerId: 'other-user',
        restaurant: { id: restaurantId },
      } as OrderEntity;

      orderRepository.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue(order);

      await expect(service.createReview(user, createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateReview', () => {
    const user = { id: 'user-1' } as User;
    const reviewId = 'review-1';
    const updateDto = { score: 1 } as UpdateReviewDto;

    it('본인의 리뷰라면 수정에 성공해야 한다', async () => {
      const review = { id: reviewId, client: { id: user.id }, score: 5 } as ReviewEntity;
      const updatedReview = { ...review, score: 1 };

      reviewRepository.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue(review);
      reviewRepository.create.mockReturnValue(updatedReview);
      reviewRepository.save.mockResolvedValue(updatedReview);

      const result = await service.updateReview(user, reviewId, updateDto);

      expect(reviewRepository.findOneWithOmitNotJoinedPropsOrThrow).toHaveBeenCalledWith(
        { id: reviewId },
        { client: true },
      );
      expect(reviewRepository.save).toHaveBeenCalledWith(updatedReview);
      expect(result.score).toBe(1);
    });

    it('본인의 리뷰가 아니면 ForbiddenException을 던져야 한다', async () => {
      const review = { id: reviewId, client: { id: 'other' } } as ReviewEntity;
      reviewRepository.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue(review);

      await expect(service.updateReview(user, reviewId, updateDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteReview', () => {
    const user = { id: 'user-1' } as User;
    const reviewId = 'review-1';

    it('본인의 리뷰라면 삭제(Soft Delete)에 성공해야 한다', async () => {
      const review = { id: reviewId, client: { id: user.id } } as ReviewEntity;
      reviewRepository.findOneWithOmitNotJoinedPropsOrThrow.mockResolvedValue(review);

      await service.deleteReview(user, reviewId);

      expect(reviewRepository.softDelete).toHaveBeenCalledWith(reviewId);
    });
  });
});
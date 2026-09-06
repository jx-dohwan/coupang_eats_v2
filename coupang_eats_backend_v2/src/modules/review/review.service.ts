import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReviewRepository } from './repository/review.repository';
import { OrderRepository } from '../order/repository/order.repository';
import { RestaurantRepository } from '../restaurant/repository/restaurant.repository';
import { User } from '../../entities/user/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { OrderStatus } from '../../common/type/common.interface';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly orderRepository: OrderRepository,
    private readonly restaurantRepository: RestaurantRepository,
  ) {}

  async createReview(user: User, dto: CreateReviewDto) {
    // 1. 주문 조회 시 식당 정보를 함께 로드
    const order =
      await this.orderRepository.findOneWithOmitNotJoinedPropsOrThrow(
        { id: dto.orderId },
        { restaurant: true },
      );

    // 2. 권한 및 상태 검증
    if (order.customerId !== user.id) {
      throw new BadRequestException('You can only review your own orders.');
    }
    // Join된 restaurant 정보 사용
    if (order.restaurant.id !== dto.restaurantId) {
      throw new BadRequestException('Order does not match restaurant.');
    }
    if (order.status !== OrderStatus.Delivered) {
      throw new BadRequestException(
        'You can only review after delivery is complete.',
      );
    }

    // 3. 중복 리뷰 방지 (1주문 1리뷰)
    // ReviewEntity에 orderId 컬럼이 있으므로 직접 조회 가능
    const existingReview = await this.reviewRepository.findOneByFilters({
      orderId: dto.orderId,
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this order.');
    }

    // 4. 리뷰 생성
    // ✅ [수정] 3번째 인자로 'order' 객체를 넘겨줘야 합니다!
    const review = dto.toEntity(user, order.restaurant, order);

    return this.reviewRepository.save(review);
  }

  /**
   * 리뷰 수정
   */
  async updateReview(user: User, reviewId: string, dto: UpdateReviewDto) {
    // 1. 관계 포함 조회 수행
    const reviewWithClient =
      await this.reviewRepository.findOneWithOmitNotJoinedPropsOrThrow(
        { id: reviewId },
        { client: true },
      );

    if (reviewWithClient.client.id !== user.id) {
      throw new ForbiddenException('You can only update your own reviews.');
    }

    // 2. 수정
    const updateReview = this.reviewRepository.create({
      ...reviewWithClient,
      ...dto,
    });

    return this.reviewRepository.save(updateReview);
  }

  /**
   * 리뷰 삭제
   */
  async deleteReview(user: User, reviewId: string) {
    const review =
      await this.reviewRepository.findOneWithOmitNotJoinedPropsOrThrow(
        { id: reviewId },
        { client: true },
      );

    if (review.client.id !== user.id) {
      throw new ForbiddenException('You can only delete your own reviews.');
    }

    // Soft Delete
    await this.reviewRepository.softDelete(reviewId);

    return { ok: true };
  }
}

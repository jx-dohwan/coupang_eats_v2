import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

// ✅ Utils
import { createTestApp, closeTestApp } from '../utils/setup';
import { dbCleanup } from '../utils/db-cleanup';

// ✅ Entities & Role
import { User } from '../../src/entities/user/user.entity';
import { Role } from '../../src/entities/user/user.interface';
import { ReviewEntity } from '../../src/entities/review/review.entity';
import { OrderStatus } from '../../src/common/type/common.interface';

describe('Review (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // 토큰 및 ID
  let clientToken: string;
  let otherClientToken: string;
  let restaurantId: string;
  let orderId: string; // 배달 완료된 주문 ID
  let reviewId: string;

  beforeAll(async () => {
    const testCtx = await createTestApp();
    app = testCtx.app;
    dataSource = testCtx.dataSource;

    await dbCleanup(dataSource);
    
    // 기초 데이터(유저, 식당, 배달완료 주문) 생성
    await setupBaseData(); 
  });

  afterAll(async () => {
    await closeTestApp(app, dataSource);
  });

  // =====================================================
  // 1. 기초 데이터 생성 Helper (Direct SQL Insert)
  // =====================================================
  async function setupBaseData() {
    const userRepo = dataSource.getRepository(User);
    const password = await bcrypt.hash('1234', 10);

    // 1. 카테고리 생성
    const catId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO category (id, created_at, updated_at, name, cover_img, slug) 
      VALUES ('${catId}', NOW(), NOW(), 'Review Cat', 'img', 'review-cat')
    `);

    // 2. 점주 (Owner) 생성
    const ownerId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO user (id, email, password, name, role, verified)
      VALUES ('${ownerId}', 'owner_rev@test.com', '${password}', 'Owner', 'Owner', 1)
    `);

    // 3. 리뷰 작성할 고객 (Client 1)
    const clientId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO user (id, email, password, name, role, verified)
      VALUES ('${clientId}', 'client1@test.com', '${password}', 'Reviewer 1', 'Client', 1)
    `);
    const client1Login = await request(app.getHttpServer()).post('/auth/sign-in').send({ email: 'client1@test.com', password: '1234' });
    clientToken = client1Login.body.data.accessToken;

    // 4. 다른 고객 (Client 2 - 권한 테스트용)
    const otherClientId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO user (id, email, password, name, role, verified)
      VALUES ('${otherClientId}', 'client2@test.com', '${password}', 'Reviewer 2', 'Client', 1)
    `);
    const client2Login = await request(app.getHttpServer()).post('/auth/sign-in').send({ email: 'client2@test.com', password: '1234' });
    otherClientToken = client2Login.body.data.accessToken;

    // 5. 식당 생성
    restaurantId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO restaurant (id, name, address, cover_img, delivery_fee, minimum_price, category_id, owner_id)
      VALUES ('${restaurantId}', 'Review Restaurant', 'Seoul', 'img', 0, 0, '${catId}', '${ownerId}')
    `);

    // 6. [핵심] '배달 완료(Delivered)' 상태의 주문 생성
    // (리뷰는 배달 완료된 주문에만 작성 가능하므로 미리 만들어둡니다)
    orderId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO \`order\` (id, total, status, customer_id, restaurant_id)
      VALUES ('${orderId}', 20000, '${OrderStatus.Delivered}', '${clientId}', '${restaurantId}')
    `);
    // order_item은 FK 제약이 없다면 생략 가능하지만, 안전을 위해 생략하거나 필요시 추가
  }

  // =====================================================
  // 2. 리뷰 테스트 시작
  // =====================================================
  describe('Review CRUD', () => {
    
    it('1. 고객이 배달 완료된 주문에 리뷰를 작성한다 (201 Created)', async () => {
      const res = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          orderId: orderId, // 필수: 어떤 주문에 대한 리뷰인지
          restaurantId: restaurantId,
          score: 5,
          reviewText: 'Really delicious!',
          reviewImg: ['http://review-img.com']
        })
        .expect(201);

      reviewId = res.body.data.id; // 생성된 리뷰 ID 저장

      // DB 검증
      const review = await dataSource.getRepository(ReviewEntity).findOne({ where: { id: reviewId } });
      expect(review).not.toBeNull();
      expect(review!.score).toBe(5);
      expect(review!.reviewText).toBe('Really delicious!');
      expect(review!.restaurantId).toBe(restaurantId);
    });

    it('2. 이미 리뷰를 작성한 주문에 또 리뷰를 쓰면 실패한다 (409 Conflict)', async () => {
      // 1주문 1리뷰 정책 검증
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          orderId: orderId,
          restaurantId: restaurantId,
          score: 3,
          reviewText: 'Duplicate review',
        })
        .expect(409); // ConflictException
    });

    it('3. 본인이 작성한 리뷰를 수정한다 (200 OK)', async () => {
      await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          score: 4,
          reviewText: 'Good but expensive',
        })
        .expect(200);

      const review = await dataSource.getRepository(ReviewEntity).findOne({ where: { id: reviewId } });
      expect(review!.score).toBe(4);
      expect(review!.reviewText).toBe('Good but expensive');
    });

    it('4. 다른 사람은 내 리뷰를 수정할 수 없다 (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${otherClientToken}`) // 다른 유저 토큰
        .send({ score: 1, reviewText: 'Hacked!' })
        .expect(403);
    });

    it('5. 본인이 작성한 리뷰를 삭제한다 (200 OK)', async () => {
        await request(app.getHttpServer())
          .delete(`/reviews/${reviewId}`)
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(200);
  
        // Soft Delete 확인 (find는 기본적으로 deleted: false인 것만 가져옴)
        const review = await dataSource.getRepository(ReviewEntity).findOne({ where: { id: reviewId } });
        expect(review).toBeNull(); 
        
        // withDeleted: true로 조회 시 존재해야 함 (Soft Delete)
        const deletedReview = await dataSource.getRepository(ReviewEntity).findOne({ 
            where: { id: reviewId }, 
            withDeleted: true 
        });
        expect(deletedReview).not.toBeNull();
        expect(deletedReview!.deletedAt).not.toBeNull();
    });
  });
});
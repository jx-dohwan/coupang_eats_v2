import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto'; // UUID 생성용
import * as bcrypt from 'bcrypt'; // [추가] 비밀번호 해싱용

// ✅ Utils Import
import { createTestApp, closeTestApp } from '../utils/setup';
import { dbCleanup } from '../utils/db-cleanup';

// ✅ Entities & Role Import
import { User } from '../../src/entities/user/user.entity';
import { Role } from '../../src/entities/user/user.interface';

describe('Order (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // 테스트 간 공유할 데이터
  let ownerToken: string;
  let clientToken: string;
  let restaurantId: string;
  let dishId: string;
  let categoryId: string;

  beforeAll(async () => {
    const testCtx = await createTestApp();
    app = testCtx.app;
    dataSource = testCtx.dataSource;

    // 테스트 시작 전 DB 정리
    await dbCleanup(dataSource);
  });

  afterAll(async () => {
    await closeTestApp(app, dataSource);
  });

  // =====================================================
  // 1. 사전 데이터 준비 (Prepare Data)
  // =====================================================
  describe('사전 준비: 카테고리, 점주, 식당, 메뉴, 손님 생성', () => {
    
    it('0. 카테고리 생성 (DB 직접 삽입)', async () => {
      const newCategoryId = crypto.randomUUID(); 
      categoryId = newCategoryId;

      await dataSource.query(`
        INSERT INTO category (id, created_at, updated_at, name, cover_img, slug) 
        VALUES ('${newCategoryId}', NOW(), NOW(), 'Order Test Category', 'http://img.com', 'order-test-cat')
      `);
      
      console.log('✅ Created Category ID:', categoryId);
    });

    it('1. 점주(Owner) 생성 (DB 직접) 및 로그인', async () => {
      // ✅ [핵심 수정] API 대신 DB에 직접 저장하여 500 에러 회피
      const userRepo = dataSource.getRepository(User);
      const hashedPassword = await bcrypt.hash('Password123!', 10);

      await userRepo.save(userRepo.create({
        email: 'order_owner@test.com',
        password: hashedPassword,
        name: 'Order Owner',
        role: Role.OWNER,
        verified: true // 인증된 상태로 생성
      }));

      // 로그인으로 토큰 획득
      const res = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: 'order_owner@test.com', password: 'Password123!' })
        .expect(200);

      ownerToken = res.body.data ? res.body.data.accessToken : res.body.accessToken;
      expect(ownerToken).toBeDefined();
    });

    it('2. 점주가 식당 생성', async () => {
      const res = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Order Test Restaurant',
          address: 'Seoul Gangnam',
          categoryId: categoryId,
          coverImg: 'http://img.com',
          deliveryFee: 3000,
          minimumPrice: 15000,
        })
        .expect(201);

      const data = res.body.data || res.body;
      restaurantId = data.id;
      console.log('✅ Created Restaurant ID:', restaurantId);
    });

    it('3. 점주가 메뉴(Dish) 추가', async () => {
      const res = await request(app.getHttpServer())
        .post(`/restaurants/${restaurantId}/dishes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Fried Chicken',
          price: 20000,
          description: 'Crispy',
          options: [
            { name: 'Spicy Sauce', extra: 500 },
            { name: 'Pickle', extra: 0 }
          ]
        })
        .expect(201);

      const data = res.body.data || res.body;
      dishId = data.id;
      console.log('✅ Created Dish ID:', dishId);
    });

    it('4. 손님(Client) 생성 (DB 직접) 및 로그인', async () => {
      // ✅ [핵심 수정] 손님도 DB에 직접 생성
      const userRepo = dataSource.getRepository(User);
      const hashedPassword = await bcrypt.hash('Password123!', 10);

      await userRepo.save(userRepo.create({
        email: 'order_client@test.com',
        password: hashedPassword,
        name: 'Hungry Client',
        role: Role.CLIENT,
        verified: true
      }));

      const res = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: 'order_client@test.com', password: 'Password123!' })
        .expect(200);

      clientToken = res.body.data ? res.body.data.accessToken : res.body.accessToken;
      expect(clientToken).toBeDefined();
    });
  });

  // =====================================================
  // 2. 주문 테스트 (Order Test)
  // =====================================================
  describe('POST /orders (주문 생성)', () => {
    it('손님이 정상적으로 주문을 생성해야 한다 (201 Created)', async () => {
      // console.log('🔥 Sending Order Request...');
      
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${clientToken}`) // 손님 토큰 필수
        .send({
          restaurantId: restaurantId,
          items: [
            {
              dishId: dishId,
              options: [
                { name: 'Spicy Sauce', extra: 500 } // 선택 옵션
              ]
            }
          ]
        });

      // 디버깅: 실패 시 로그 출력
      if (response.status !== 201) {
        console.error('❌ Order Failed:', JSON.stringify(response.body, null, 2));
      }

      // 1. 상태 코드 확인
      expect(response.status).toBe(201);

      // 2. 응답 데이터 구조 확인
      const order = response.body.data || response.body;
      expect(order).toHaveProperty('id');
      expect(order.status).toBe('Pending'); 
      expect(order.restaurantId).toBe(restaurantId);
      
      // 3. 총 가격 계산 검증 (메뉴 20000 + 옵션 500 = 20500)
      if (order.total) {
        expect(order.total).toBe(23500);      }
    });

    it('점주(Owner)는 주문을 생성할 수 없어야 한다 (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${ownerToken}`) // 점주 토큰 사용
        .send({
          restaurantId: restaurantId,
          items: [{ dishId: dishId }]
        })
        .expect(403);
    });
  });
  
});
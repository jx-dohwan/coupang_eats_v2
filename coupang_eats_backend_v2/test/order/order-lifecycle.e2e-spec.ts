import  request from 'supertest';
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
import { OrderEntity } from '../../src/entities/order/order.entity';
import { OrderStatus } from '../../src/common/type/common.interface'; 

describe('Order Lifecycle (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // 토큰 및 ID
  let ownerToken: string;
  let clientToken: string;
  let deliveryToken: string;
  let restaurantId: string;
  let dishId: string;
  let orderId: string;

  beforeAll(async () => {
    const testCtx = await createTestApp();
    app = testCtx.app;
    dataSource = testCtx.dataSource;

    // 1. DB 초기화
    await dbCleanup(dataSource);

    // 2. [기초 데이터 세팅]
    await setupBaseData();

    // 3. [주문 생성]
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        restaurantId: restaurantId,
        items: [{ dishId: dishId, options: [] }]
      })
      .expect(201);
    
    orderId = res.body.data.id;
    console.log('✅ Prepared Order ID:', orderId);
  });

  afterAll(async () => {
    await closeTestApp(app, dataSource);
  });

  // =====================================================
  // Helper Function
  // =====================================================
  async function setupBaseData() {
    const userRepo = dataSource.getRepository(User);
    const password = await bcrypt.hash('1234', 10);

    // A. 카테고리
    const catId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO category (id, created_at, updated_at, name, cover_img, slug) 
      VALUES ('${catId}', NOW(), NOW(), 'Lifecycle Cat', 'img', 'lifecycle-cat')
    `);

    // B. 점주 (Owner)
    await userRepo.save(userRepo.create({
      email: 'owner_life@test.com', password, name: 'Owner', role: Role.OWNER, verified: true
    }));
    const ownerLogin = await request(app.getHttpServer()).post('/auth/sign-in').send({ email: 'owner_life@test.com', password: '1234' });
    ownerToken = ownerLogin.body.data.accessToken;

    // C. 배달원 (Delivery)
    await userRepo.save(userRepo.create({
      email: 'driver_life@test.com', password, name: 'Driver', role: Role.DELIVERY, verified: true
    }));
    const driverLogin = await request(app.getHttpServer()).post('/auth/sign-in').send({ email: 'driver_life@test.com', password: '1234' });
    deliveryToken = driverLogin.body.data.accessToken;

    // D. 손님 (Client)
    await userRepo.save(userRepo.create({
      email: 'client_life@test.com', password, name: 'Client', role: Role.CLIENT, verified: true
    }));
    const clientLogin = await request(app.getHttpServer()).post('/auth/sign-in').send({ email: 'client_life@test.com', password: '1234' });
    clientToken = clientLogin.body.data.accessToken;

    // E. 식당 생성
    const restRes = await request(app.getHttpServer())
      .post('/restaurants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Life Cycle Rest', address: 'Seoul', categoryId: catId, coverImg: 'img', deliveryFee: 0, minimumPrice: 0
      });
    restaurantId = restRes.body.data.id;

    // F. 메뉴 생성
    const dishRes = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/dishes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Pizza', price: 10000, description: 'Yum', options: [] });
    dishId = dishRes.body.data.id;
  }

  // =====================================================
  // 테스트 시작: 상태 변경 흐름
  // =====================================================

  describe('주문 상태 변경 흐름 (Pending -> Delivered)', () => {
    
    // 1. 점주: Pending -> Cooking
    it('1. 점주가 주문을 수락하면 상태가 Cooking이 되어야 한다', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'Cooking' })
        // ✅ [수정] Patch는 기본적으로 200 OK를 반환합니다.
        .expect(200); 

      const order = await dataSource.getRepository(OrderEntity).findOne({ where: { id: orderId } });
      
      expect(order).not.toBeNull(); 
      expect(order!.status).toBe(OrderStatus.Cooking);
    });

    // 2. 점주: Cooking -> Cooked
    it('2. 점주가 조리를 완료하면 상태가 Cooked가 되어야 한다', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'Cooked' })
        // ✅ [수정] 201 -> 200
        .expect(200);

      const order = await dataSource.getRepository(OrderEntity).findOne({ where: { id: orderId } });
      
      expect(order).not.toBeNull();
      expect(order!.status).toBe(OrderStatus.Cooked);
    });

    // 3. 배달원: Cooked -> PickedUp (권한 체크)
    it('3. 배달원이 주문을 픽업(PickedUp)하면 상태 변경 및 기사가 배정되어야 한다', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${deliveryToken}`)
        .send({ status: 'PickedUp' })
        // ✅ [수정] 201 -> 200
        .expect(200);

      const order = await dataSource.getRepository(OrderEntity).findOne({ 
        where: { id: orderId },
        relations: ['driver']
      });
      
      expect(order).not.toBeNull();
      expect(order!.status).toBe(OrderStatus.PickedUp);
      expect(order!.driver).toBeDefined(); 
      expect(order!.driver.email).toBe('driver_life@test.com');
    });

    // 4. 배달원: PickedUp -> Delivered
    it('4. 배달원이 배달을 완료(Delivered)할 수 있다', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${deliveryToken}`)
        .send({ status: 'Delivered' })
        // ✅ [수정] 201 -> 200
        .expect(200);

      const order = await dataSource.getRepository(OrderEntity).findOne({ where: { id: orderId } });
      
      expect(order).not.toBeNull();
      expect(order!.status).toBe(OrderStatus.Delivered);
    });

    // 5. 권한 없는 접근 테스트 (보안)
    it('5. 손님(Client)은 주문 상태를 변경할 수 없다 (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ status: 'Cooking' })
        .expect(403);
    });

    it('6. 다른 점주(Owner)는 내 가게 주문 상태를 변경할 수 없다 (403 Forbidden)', async () => {
        // 다른 점주 생성
        const userRepo = dataSource.getRepository(User);
        const password = await bcrypt.hash('1234', 10);
        await userRepo.save(userRepo.create({
            email: 'other_owner@test.com', password, name: 'Other Owner', role: Role.OWNER, verified: true
        }));
        const loginRes = await request(app.getHttpServer()).post('/auth/sign-in').send({ email: 'other_owner@test.com', password: '1234' });
        const otherOwnerToken = loginRes.body.data.accessToken;

        await request(app.getHttpServer())
            .patch(`/orders/${orderId}`)
            .set('Authorization', `Bearer ${otherOwnerToken}`)
            .send({ status: 'Cooking' })
            .expect(403);
    });
  });
});
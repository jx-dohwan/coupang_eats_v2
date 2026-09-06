import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

import { createTestApp, closeTestApp } from '../utils/setup';
import { dbCleanup } from '../utils/db-cleanup';

import { User } from '../../src/entities/user/user.entity';
import { Role } from '../../src/entities/user/user.interface';
import { PaymentEntity } from '../../src/entities/payment/payment.entity';

describe('Payment (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // 토큰 및 ID
  let clientToken: string;
  let otherClientToken: string;
  let restaurantId: string;
  let orderId: string;

  beforeAll(async () => {
    const testCtx = await createTestApp();
    app = testCtx.app;
    dataSource = testCtx.dataSource;

    await dbCleanup(dataSource);
    await setupBaseData(); // 기초 데이터(유저, 식당, 주문) 생성
  });

  afterAll(async () => {
    await closeTestApp(app, dataSource);
  });

  // =====================================================
  // 1. 기초 데이터 생성 Helper
  // =====================================================
  async function setupBaseData() {
    const userRepo = dataSource.getRepository(User);
    const password = await bcrypt.hash('1234', 10);

    // 1. 카테고리
    const catId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO category (id, created_at, updated_at, name, cover_img, slug) 
      VALUES ('${catId}', NOW(), NOW(), 'Payment Cat', 'img', 'pay-cat')
    `);

    // 2. 점주
    const ownerId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO user (id, email, password, name, role, verified)
      VALUES ('${ownerId}', 'owner_pay@test.com', '${password}', 'Owner', 'Owner', 1)
    `);

    // 3. 결제할 고객 (Client 1)
    const clientId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO user (id, email, password, name, role, verified)
      VALUES ('${clientId}', 'client_pay@test.com', '${password}', 'Payer', 'Client', 1)
    `);
    const clientLogin = await request(app.getHttpServer()).post('/auth/sign-in').send({ email: 'client_pay@test.com', password: '1234' });
    clientToken = clientLogin.body.data.accessToken;

    // 4. 다른 고객 (Client 2 - 권한 테스트용)
    const otherClientId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO user (id, email, password, name, role, verified)
      VALUES ('${otherClientId}', 'hacker@test.com', '${password}', 'Hacker', 'Client', 1)
    `);
    const otherLogin = await request(app.getHttpServer()).post('/auth/sign-in').send({ email: 'hacker@test.com', password: '1234' });
    otherClientToken = otherLogin.body.data.accessToken;

    // 5. 식당 생성
    restaurantId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO restaurant (id, name, address, cover_img, delivery_fee, minimum_price, category_id, owner_id)
      VALUES ('${restaurantId}', 'Pay Restaurant', 'Seoul', 'img', 0, 0, '${catId}', '${ownerId}')
    `);

    // 6. 주문 생성 (Client 1의 주문)
    orderId = crypto.randomUUID();
    await dataSource.query(`
      INSERT INTO \`order\` (id, total, status, customer_id, restaurant_id)
      VALUES ('${orderId}', 15000, 'Pending', '${clientId}', '${restaurantId}')
    `);
  }

  // =====================================================
  // 2. 결제 테스트 시작
  // =====================================================
  describe('Payment Process', () => {
    const transactionId = 'imp_test_123456';

    it('1. 다른 사람의 주문을 결제하려 하면 실패한다 (400 Bad Request)', async () => {
      // Client 2가 Client 1의 주문 결제 시도
      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${otherClientToken}`)
        .send({
          transactionId: 'imp_hacked',
          orderId: orderId,
        })
        .expect(400); // Service 로직: "You cannot pay for this order."
    });

    it('2. 본인 주문에 대해 정상적으로 결제한다 (201 Created)', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          transactionId: transactionId,
          orderId: orderId,
        })
        .expect(201);

      // DB 검증
      const payment = await dataSource.getRepository(PaymentEntity).findOne({ where: { orderId } });
      expect(payment).not.toBeNull();
      expect(payment!.transactionId).toBe(transactionId);
      expect(payment!.userId).toBeDefined(); // Client ID
      expect(payment!.restaurantId).toBe(restaurantId);
    });

    it('3. 이미 결제된 주문을 중복 결제하려 하면 실패한다 (400 Bad Request)', async () => {
      // 동일한 주문 ID로 다시 결제 시도
      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          transactionId: 'imp_new_trans_id',
          orderId: orderId,
        })
        .expect(400); // Service 로직: "Order is already paid."
    });
  });
});
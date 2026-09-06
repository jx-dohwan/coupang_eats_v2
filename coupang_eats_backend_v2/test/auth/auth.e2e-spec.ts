import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

// ✅ 경로 확인 필수
import { createTestApp, closeTestApp } from '../utils/setup';
import { dbCleanup } from '../utils/db-cleanup';
import { User } from '../../src/entities/user/user.entity';
import { Role } from '../../src/entities/user/user.interface';

describe('AuthModule (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const testCtx = await createTestApp();
    app = testCtx.app;
    dataSource = testCtx.dataSource;
  });

  afterAll(async () => {
    await closeTestApp(app, dataSource);
  });

  afterEach(async () => {
    await dbCleanup(dataSource);
  });

  describe('POST /auth/sign-up (회원가입)', () => {
    const validPassword = 'Password123!';

    const signUpDto = {
      email: 'test@example.com',
      password: validPassword,
      name: 'TestUser',
      role: 'Client',
    };

    it('성공 시 201 Created를 반환하고 DB에 유저가 생성되어야 한다', async () => {
      await request(app.getHttpServer())
        .post('/auth/sign-up')
        .send(signUpDto)
        .expect(201);

      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: signUpDto.email },
      });

      // ✅ [수정 1] user가 null이 아님을 Jest로 확인
      expect(user).not.toBeNull();

      // ✅ [수정 2] user! 를 사용하여 TypeScript 에러 해결
      expect(user!.email).toBe(signUpDto.email);
      expect(user!.role).toBe(Role.CLIENT);
      expect(user!.verified).toBe(false);

      const isMatch = await bcrypt.compare(validPassword, user!.password);
      expect(isMatch).toBe(true);
    });

    it('비밀번호 형식이 맞지 않으면 400 Bad Request를 반환해야 한다', async () => {
      const invalidDto = { ...signUpDto, password: 'weak' };

      await request(app.getHttpServer())
        .post('/auth/sign-up')
        .send(invalidDto)
        .expect(400);
    });

    it('중복된 이메일로 가입 시 409 Conflict를 반환해야 한다', async () => {
      await request(app.getHttpServer())
        .post('/auth/sign-up')
        .send(signUpDto)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/sign-up')
        .send(signUpDto)
        .expect(409);
    });
  });

  describe('POST /auth/sign-in (로그인)', () => {
    const password = 'Password123!';
    const hashedPassword = bcrypt.hashSync(password, 10);

    const testUser = {
      email: 'login@example.com',
      password: hashedPassword,
      name: 'LoginUser',
      role: Role.CLIENT,
      verified: true,
    };

    beforeEach(async () => {
      const userRepo = dataSource.getRepository(User);
      // userRepo.create의 반환 타입 문제를 피하기 위해 any 캐스팅 혹은 spread 사용 가능
      // 여기서는 가장 간단하게 객체를 직접 save에 전달
      await userRepo.save(userRepo.create(testUser as any));
    });

    it('성공 시 200 OK, AccessToken 반환, RefreshToken 쿠키 설정을 해야 한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({
          email: testUser.email,
          password: password,
        })
        .expect(200);

      // ✅ [수정] 응답 래핑(wrapper) 구조 반영
      // 실제 토큰은 response.body.data 안에 있습니다.
      expect(response.body.data).toHaveProperty('accessToken');

      // 쿠키 확인 로직은 그대로 유지
      const cookies = response.get('Set-Cookie');
      expect(cookies).toBeDefined();
      expect(cookies?.some((c) => c.includes('refreshToken'))).toBe(true);
    });

    it('비밀번호 불일치 시 401 Unauthorized를 반환해야 한다', async () => {
      await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('이메일 미인증 유저라면 401 Unauthorized를 반환해야 한다', async () => {
      const userRepo = dataSource.getRepository(User);
      await userRepo.update({ email: testUser.email }, { verified: false });

      await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({
          email: testUser.email,
          password: password,
        })
        .expect(401);
    });
  });
});

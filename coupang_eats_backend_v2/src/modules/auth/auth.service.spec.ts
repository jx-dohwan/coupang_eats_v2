import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthTxService } from './auth.tx.service';
import { UserRepository } from '../user/repository/user.repository';
import { TokenService } from '../../core/jwt/jwt.service';
import { LoggerService } from '../../core/logger/logger.service';
import { CacheServiceKey } from '../../core/cache/cache.interface';
import { HASH_SERVICE } from '../../core/hash/hash.interface';
import { NOTIFICATION_SERVICE } from '../../core/notification/notification.interface';
import { User } from '../../entities/user/user.entity';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let authTxService: any; // Mocked
  let userRepository: any; // Mocked
  let tokenService: any; // Mocked
  let hashService: any; // Mocked
  let cacheService: any; // Mocked
  let notificationService: any; // Mocked

  beforeEach(async () => {
    // 1. Mock 객체 정의
    const mockAuthTxService = {
      createUserOrThrow: jest.fn(),
    };
    const mockUserRepository = {
      findOneByFilters: jest.fn(),
      findOneOrThrow: jest.fn(),
      save: jest.fn(),
    };
    const mockTokenService = {
      generateTokenPair: jest.fn(),
      revokeAllUserTokens: jest.fn(),
      refreshTokens: jest.fn(),
    };
    const mockLoggerService = {
      error: jest.fn(),
    };
    const mockHashService = {
      compare: jest.fn(),
      hash: jest.fn(),
    };
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    const mockNotificationService = {
      sendWelcomeNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        // ✅ [핵심] AuthTxService 모킹 주입 (DataSource 대신 사용됨)
        { provide: AuthTxService, useValue: mockAuthTxService },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: TokenService, useValue: mockTokenService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: HASH_SERVICE, useValue: mockHashService },
        { provide: CacheServiceKey, useValue: mockCacheService },
        { provide: NOTIFICATION_SERVICE, useValue: mockNotificationService },
        // DataSource는 이제 AuthService에서 직접 안 쓰므로 제거해도 됨
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authTxService = module.get<AuthTxService>(AuthTxService);
    userRepository = module.get(UserRepository);
    tokenService = module.get(TokenService);
    hashService = module.get(HASH_SERVICE);
    cacheService = module.get(CacheServiceKey);
    notificationService = module.get(NOTIFICATION_SERVICE);
  });

  describe('validateUser', () => {
    it('이메일이 존재하고 비밀번호가 일치하면 유저를 반환해야 한다.', async () => {
      const user = { id: '1', password: 'hashed_password' } as User;
      userRepository.findOneByFilters.mockResolvedValue(user);
      hashService.compare.mockResolvedValue(true);

      const result = await service.validateUser('test@test.com', '1234');
      expect(result).toEqual(user);
    });

    it('유저가 존재하지 않으면 null을 반환해야 한다.', async () => {
      userRepository.findOneByFilters.mockResolvedValue(null);
      const result = await service.validateUser('no@test.com', '1234');
      expect(result).toBeNull();
    });

    it('비밀번호가 틀리면 null을 반환해야 한다.', async () => {
      const user = { id: '1', password: 'hashed_password' } as User;
      userRepository.findOneByFilters.mockResolvedValue(user);
      hashService.compare.mockResolvedValue(false);

      const result = await service.validateUser('test@test.com', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('signUp', () => {
    const signUpBody: any = {
      email: 'new@test.com',
      password: '123',
      name: 'Tester',
      role: 'Client',
    };

    it('정상적인 회원가입 시 트랜잭션 서비스 호출 후 캐시/알림이 실행되어야 한다.', async () => {
      // Given
      hashService.hash.mockResolvedValue('hashed_123');
      authTxService.createUserOrThrow.mockResolvedValue(undefined); // 성공 시 void 반환

      // When
      await service.signUp(signUpBody);

      // Then
      // 1. 비밀번호 해싱 확인
      expect(hashService.hash).toHaveBeenCalledWith(signUpBody.password);
      
      // 2. AuthTxService(트랜잭션 담당)가 호출되었는지 확인
      expect(authTxService.createUserOrThrow).toHaveBeenCalledWith(
        signUpBody,
        'hashed_123',
      );

      // 3. 외부 서비스(Redis, Email) 호출 확인
      expect(cacheService.set).toHaveBeenCalled();
      expect(notificationService.sendWelcomeNotification).toHaveBeenCalled();
    });

    it('AuthTxService에서 에러 발생 시(중복 이메일 등) 예외를 그대로 던져야 한다.', async () => {
      // Given
      hashService.hash.mockResolvedValue('hashed_123');
      // AuthTxService가 ConflictException을 던진다고 가정
      authTxService.createUserOrThrow.mockRejectedValue(
        new ConflictException('이미 존재하는 이메일입니다.'),
      );

      // When & Then
      await expect(service.signUp(signUpBody)).rejects.toThrow(
        ConflictException,
      );
      
      // 외부 서비스는 호출되지 않아야 함
      expect(cacheService.set).not.toHaveBeenCalled();
      expect(notificationService.sendWelcomeNotification).not.toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('로그인 성공 시 토큰 쌍을 반환해야 한다.', async () => {
      const user = { id: 'user-1', verified: true, password: 'hashed' } as User;
      
      // validateUser 내부 로직 Mocking
      userRepository.findOneByFilters.mockResolvedValue(user);
      hashService.compare.mockResolvedValue(true);
      
      tokenService.generateTokenPair.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
      });

      const result = await service.signIn({
        email: 't@t.com',
        password: 'p',
      } as any);

      expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
    });

    it('이메일 인증이 안 된 유저는 UnauthorizedException을 던져야 한다', async () => {
      const user = { id: 'user-1', verified: false, password: 'hashed' } as User;
      
      userRepository.findOneByFilters.mockResolvedValue(user);
      hashService.compare.mockResolvedValue(true);

      await expect(
        service.signIn({ email: 't@t.com', password: 'p' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('유저 검증 실패 시(없는 유저) UnauthorizedException을 던져야 한다.', async () => {
      userRepository.findOneByFilters.mockResolvedValue(null);

      await expect(
        service.signIn({ email: 't@t.com', password: 'p' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
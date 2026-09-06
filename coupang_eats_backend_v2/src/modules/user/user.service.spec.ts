import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserRepository } from './repository/user.repository';
import { User } from '../../entities/user/user.entity';
import { NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { HASH_SERVICE } from '../../core/hash/hash.interface';
import { CacheServiceKey, CacheKeys } from '../../core/cache/cache.interface';

// 1. Mock 객체 정의
const mockUserRepository = {
  findByIdOrThrow: jest.fn(),
  save: jest.fn(),
};

const mockHashService = {
  hash: jest.fn(),
};

const mockCacheService = {
  del: jest.fn(), // 캐시 삭제 검증용
  get: jest.fn(),
  set: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;
  let userRepository: typeof mockUserRepository;
  let hashService: typeof mockHashService;
  let cacheService: typeof mockCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: HASH_SERVICE, useValue: mockHashService },
        { provide: CacheServiceKey, useValue: mockCacheService }, // CacheService 주입
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(UserRepository);
    hashService = module.get(HASH_SERVICE);
    cacheService = module.get(CacheServiceKey);

    jest.clearAllMocks(); // 각 테스트 격리
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUser', () => {
    it('유저 ID로 유저를 조회해야 한다', async () => {
      // Arrange
      const userId = 'user-1';
      const user = { id: userId, name: 'Test' } as User;
      userRepository.findByIdOrThrow.mockResolvedValue(user);

      // Act
      const result = await service.getUser(userId);

      // Assert
      expect(userRepository.findByIdOrThrow).toHaveBeenCalledWith(userId);
      expect(result).toEqual(user);
      // 주의: @Cache 데코레이터 자체는 유닛 테스트 범위 밖(Interceptor)이므로,
      // 여기서는 비즈니스 로직 호출 여부만 검증합니다.
    });
  });

  describe('updateUser', () => {
    const userId = 'user-1';
    const dto: UpdateUserDto = {
      name: 'New Name',
      password: 'newPassword123!',
    };

    it('이름과 비밀번호를 모두 수정하고, 저장 후 캐시를 삭제해야 한다', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        name: 'Old Name',
        password: 'oldHash',
      } as User;
      const hashedPw = 'newHashedPassword';
      const updatedUser = {
        ...existingUser,
        name: dto.name,
        password: hashedPw,
      };

      userRepository.findByIdOrThrow.mockResolvedValue(existingUser);
      mockHashService.hash.mockResolvedValue(hashedPw);
      userRepository.save.mockResolvedValue(updatedUser);

      // Act
      const result = await service.updateUser(userId, dto);

      // Assert
      // 1. 유저 조회 확인
      expect(userRepository.findByIdOrThrow).toHaveBeenCalledWith(userId);

      // 2. 비밀번호 암호화 호출 확인
      expect(mockHashService.hash).toHaveBeenCalledWith(dto.password);

      // 3. DB 저장 확인 (변경된 값 포함)
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          password: hashedPw,
        }),
      );

      // 4. [핵심] 캐시 무효화 호출 확인
      // 키 생성 규칙: CacheKeys.User + userId
      expect(cacheService.del).toHaveBeenCalledWith(
        `${CacheKeys.User}${userId}`,
      );

      expect(result).toEqual(updatedUser);
    });

    it('비밀번호 없이 이름만 변경할 경우, 암호화 로직은 건너뛰고 캐시는 삭제해야 한다', async () => {
      // Arrange
      const dtoOnlyName = { name: 'Only Name' };
      const existingUser = {
        id: userId,
        name: 'Old Name',
        password: 'oldHash',
      } as User;
      const updatedUser = { ...existingUser, name: dtoOnlyName.name };

      userRepository.findByIdOrThrow.mockResolvedValue(existingUser);
      userRepository.save.mockResolvedValue(updatedUser);

      // Act
      await service.updateUser(userId, dtoOnlyName);

      // Assert
      expect(mockHashService.hash).not.toHaveBeenCalled(); // 암호화 안 함
      expect(userRepository.save).toHaveBeenCalled();
      expect(cacheService.del).toHaveBeenCalledWith(
        `${CacheKeys.User}${userId}`,
      ); // 캐시는 여전히 삭제
    });

    it('유저가 존재하지 않으면 NotFoundException을 던지고, 캐시는 삭제하지 않아야 한다', async () => {
      // Arrange
      userRepository.findByIdOrThrow.mockRejectedValue(new NotFoundException());

      // Act & Assert
      await expect(service.updateUser(userId, dto)).rejects.toThrow(
        NotFoundException,
      );

      // 예외 발생 시 이후 로직 실행 안 됨
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(cacheService.del).not.toHaveBeenCalled();
    });
  });
});

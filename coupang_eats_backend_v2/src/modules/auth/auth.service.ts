import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { TokenService } from '../../core/jwt/jwt.service';
import { User } from '../../entities/user/user.entity';
import { TokenPair } from '../../core/jwt/jwt.interface';
import { LoggerService } from '../../core/logger/logger.service';
import { HASH_SERVICE } from '../../core/hash/hash.interface';
import type { IHashService } from '../../core/hash/hash.interface';
import { SignUpBody } from './dto/request/signUp.body';
import { UserRepository } from '../user/repository/user.repository';
import { SignInBody } from './dto/request/signIn.body';
import { CacheService } from '../../core/cache/cache.service';
import {
  type INotificationService,
  NOTIFICATION_SERVICE,
} from '../../core/notification/notification.interface';
import { NotFound } from '@aws-sdk/client-s3';
import { CacheServiceKey } from '../../core/cache/cache.interface';
import { DataSource } from 'typeorm';
import { AuthTxService } from './auth.tx.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly authTxService: AuthTxService,
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly loggerService: LoggerService,
    @Inject(CacheServiceKey) private readonly cacheService: CacheService,
    // 의존성 역전 원칙 적용: 구현체(BcryptService) 대신 인터페이스(HASH_SERVICE) 주입
    @Inject(HASH_SERVICE) private readonly hashService: IHashService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: INotificationService,
  ) {}

  /**
   * [유저 검증] 이메일 존재 여부 및 비밀번호 일치 확인
   * 성공 시 User 객체, 실패 시 null 반환
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findOneByFilters({ email });

      // 유저가 없거나 비밀번호가 틀리면 null 반환
      if (!user || !(await this.hashService.compare(password, user.password))) {
        return null;
      }

      return user;
    } catch (error) {
      this.loggerService.error(
        this.validateUser.name,
        error,
        'Failed to Validate user',
      );
      return null;
    }
  }

  /**
   * [회원가입] 유저 생성
   * @Transactional 데코레이터로 DB 작업 원자성 보장
   */
  async signUp(body: SignUpBody): Promise<void> {
    const { email, password } = body;
    const hashedPassword = await this.hashService.hash(password);

    // ✅ DB만 트랜잭션
    await this.authTxService.createUserOrThrow(body, hashedPassword);

    // ✅ 외부(Redis/Email)는 트랜잭션 밖
    const token = uuidv4();
    await this.cacheService.set(`email-verify:${token}`, email, 300);
    await this.notificationService.sendWelcomeNotification(email, '고객', token);
  }

  /**
   * 이메일 인증 확인, 유저가 메일 링크를 클릭하면 이 함수가 실행
   */
  async verifyEmail(token: string): Promise<void> {
    const redisKey = `email-verify:${token}`;

    // 1. Redis에서 토큰으로 이메일 조회
    const email = await this.cacheService.get(redisKey);
    if (!email) {
      throw new BadRequestException(
        '인증 링크가 만료되었거나 유효하지 않습니다.',
      );
    }

    // 2. [최적화] 유저 찾기 (없으면 404 자동 발생)
    const user = await this.userRepository.findOneOrThrow({ email });

    // 3. 이미 인증된 유저는 패스
    if (user.verified) {
      return;
    }

    // 4. 인증 상태 업데이트
    user.verified = true;
    await this.userRepository.save(user);

    // 5. 사용한 토큰 삭제(재사용 방지)
    await this.cacheService.del(redisKey);
  }

  /**
   * [로그인] 유저 검증 후 토큰 발급
   */
  async signIn(body: SignInBody): Promise<TokenPair> {
    const { email, password } = body;

    // 1. 아이디/비밀번호 확인
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.verified) {
      throw new UnauthorizedException('이메일 인증을 완료해주세요.');
    }

    // 2. Access/Refresh 토큰 쌍 생성 및 반환
    return this.tokenService.generateTokenPair(user.id);
  }

  /**
   * [로그아웃] Refresh Token 삭제 및 Access Token 블랙리스트 처리
   */
  async signOut(userId: User['id'], accessToken: string): Promise<void> {
    await this.tokenService.revokeAllUserTokens(userId, accessToken);
  }

  /**
   * [토큰 갱신] Refresh Token을 이용해 새로운 토큰 쌍 발급 (RTR)
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.refreshTokens(refreshToken);
  }
}

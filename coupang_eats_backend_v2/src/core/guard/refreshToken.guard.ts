import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LoggerService } from '../logger/logger.service';
import { RequestContextService } from '../cls/cls.service';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  constructor(
    private loggerService: LoggerService,
    private readonly requestContextService: RequestContextService,
  ) {
    super();
  }

  /**
   * 부모 클래스의(AuthGuard)의 메서드를 오버라이딩(재정의)한다
   * 전략 실행 결과에 따라 예외를 던지거나, 유저 객체를 반환하는 로직을 커스텀한다.
   * @param err - Passport 전략 실행 중 발생한 시스템 에러
   * @param user - 전략의 validate() 메서드가 성공적으로 반환한 값 (보통 payload)
   * @param error - JWT 검증 실패 시 발생하는 에러(예: 토큰 만료, 서명 불일치)
   * @returns
   */
  handleRequest(err: any, user: any, error: Error) {
    // jwt 관련 에러(만료 등)가 발생했으면 예외 발생
    if (error) {
      throw new UnauthorizedException(error.message);
    }

    // 유저 객체가 없거나 시스템 에러가 있으면 예외 발생
    if (!user) throw new UnauthorizedException('invalid token');

    const requestId = this.requestContextService.getRequestId();

    // 검증 성공 로그 기록
    this.loggerService.info(
      this.handleRequest.name,
      {
        requestId,
        userId: user.sub, // Refresh Token은 보통 sub에 ID가 있음
      },
      `RefreshTokenGuard Success: userId: ${user.id}`,
    );

    // 반환
    return user;
  }
}

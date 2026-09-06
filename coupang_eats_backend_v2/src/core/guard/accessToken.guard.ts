import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { LoggerService } from '../logger/logger.service';
import { IS_PUBLIC_KEY } from '../decorator/public.decorator';
import { isRFC3339 } from 'class-validator';
import { RequestContextService } from '../cls/cls.service';

@Injectable()
export class AccessTokenGuard extends AuthGuard('jwt-access') {
  constructor(
    private readonly reflector: Reflector,
    private readonly loggerService: LoggerService,
    private readonly requestContextService: RequestContextService,
  ) {
    super();
  }

  // 가드 실행 진입점, 요청이 들어오면 가장 먼저 실행되는 메서드이다.
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // @Public() 데코레이터가 붙어있는지
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // 메서드 레벨 확인
      context.getClass(), // 클래스 레벨 확인
    ]);
    if (isPublic) { // public이면 인증 검사 없이 통과(true 반환)
      return true;
    }

    // public이 아니면 부모 로직 실행 -> Strategy의 validate() 호출됨
    return super.canActivate(context);
  }

  /**
   * 요청 처리 핸들러로 Strategy 검증이 끝난 후 호출된다. 예외 처리를 커스텀
   * @param err  - Passport 내부 에러
   * @param user - Strategy의 validate()가 반환한 유저 객체
   * @returns 
   */
  handleRequest(err: any, user: any) {
    // 에러가 있거나 유저를 찾지 못했으면 예외 발생
    if (err) throw new UnauthorizedException(err.message);
    if (!user) throw new UnauthorizedException('invalid token');

    // CLS에서 Request ID 가져오기
    const requestId = this.requestContextService.getRequestId();


    // 성공 로그 남기기
    this.loggerService.info(
      this.handleRequest.name,
      {
        requestId,
        userId: user.id
      },
      `AccessTokenGuard Success: userId: ${user.id}`,
    );


    return user;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorator/public.decorator';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '../cls/cls.service';
import { LoggerService } from '../logger/logger.service';
import { TokenService } from '../jwt/jwt.service';

@Injectable()
export class JwtBlacklistGuard implements CanActivate {
  constructor(
    private reflector: Reflector, // 메타데이터를 읽어오기 위한 도구
    private tokenService: TokenService, // 블랙리스트 확인 로직이 들어가있는 서비스
    private readonly loggerService: LoggerService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // 요청이 들어올 때 실행되는 메서드로, true를 반환하면 요청 허용, false나 예외를 던디면 요청 거부
  async canActivate(context: ExecutionContext): Promise<boolean> {
    //핸들러나 클래스에 'isPublic' 메타데이터가 있는지 확인
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // public 라우트(로그인/회원가입)라면 블랙리스트 검사를 하지 않고 통과
    if (isPublic) {
      return true;
    }

    // HTTP 요청 객체 및 토큰 추출
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    // Bearer '를 제거하고 토큰 값만 가져옴 authHeader가 없으면 undefined가 되므로 안전하게 처리
    const token = authHeader?.replace('Bearer ', '');

    // 토큰이 아예 없다면 검증할 수 없으므로 에러 처리
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    // 토큰 블랙리스트 확인, Redis나 DB를 조회하여 이 토큰이 로그아웃 처리가 된 토큰인지 확인
    const isBlacklisted = await this.tokenService.isTokenBlacklisted(token);
    // 블랙리스트에 등록된 토큰이라면 접근을 거부
    if (isBlacklisted) {
      const requestId = this.requestContextService.getRequestId();
      this.loggerService.warn(
        this.canActivate.name, // 1. 메서드 이름 (Context)
        {
          requestId,
          token, // 2. 데이터 객체 (필요하다면 보안을 위해 token 일부만 로깅 추천)
        },
        'JwtBlacklistGuard Error: Token has been revoked', // 3. 로그 메시지
      );
      throw new UnauthorizedException('Token has been revoked');
    }
    // 모든 검사를 통과했으면 요청을 허용
    return true;
  }
}

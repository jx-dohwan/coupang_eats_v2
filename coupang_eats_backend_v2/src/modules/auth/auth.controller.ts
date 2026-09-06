import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { User } from '../../entities/user/user.entity';
import { AuthService } from './auth.service';
import { SignUpBody } from './dto/request/signUp.body';
import { SignInBody } from './dto/request/signIn.body';
import { RefreshBody } from './dto/request/refresh.body';
import { CurrentUser } from '../../core/decorator/currentUser.decorator';
import { ExtractJwt } from 'passport-jwt';
import { Public } from '../../core/decorator/public.decorator';
import { RefreshTokenGuard } from '../../core/guard/refreshToken.guard';
import { Env } from '../../core/config';
import { CurrentRefreshToken } from '../../core/decorator/currentRefreshToken.decorator';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CoreOutput } from '../../common/dto/core.output';
import { AccessTokenResponse } from './dto/response/access-token.response';
import { ApiDocOk, ApiDocPublicCreated } from '../../core/decorator/swagger.decorator';

@ApiTags('Auth (인증)')
@Controller('auth')
export class AuthController {
  private readonly isLocal: boolean;
  private readonly cookieSecure: boolean;

  constructor(private readonly authService: AuthService) {
    this.isLocal = process.env.NODE_ENV === Env.local;
    const baseUrl = process.env.BASE_URL || '';
    // Secure 쿠키는 HTTPS(BASE_URL)일 때만. HTTP ALB(dev, ACM 미적용)에서는 false 필수
    this.cookieSecure = baseUrl.startsWith('https://');
  }

  private setRefreshTokenCookie(res: any, refreshToken: string): void {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: !this.isLocal,
      secure: this.cookieSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshTokenCookie(res: any): void {
    res.clearCookie('refreshToken', {
      httpOnly: !this.isLocal,
      secure: this.cookieSecure,
      sameSite: 'lax',
    });
  }

  // 1. 회원가입 API (토큰 발급 안 함)
  @ApiDocPublicCreated('회원가입', CoreOutput)
  @Public() // 인증 없이 접근 가능
  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() body: SignUpBody) {
    return this.authService.signUp(body);
  }

  // 2. 로그인 API
  @ApiDocOk('로그인', AccessTokenResponse)
  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() body: SignInBody,
    // passthrough: true -> NestJS가 응답을 처리하되, 우리가 쿠키나 헤더를 직접 조작할 수 있게 함
    @Response({ passthrough: true }) res: any,
  ) {
    const tokenPair = await this.authService.signIn(body);

    // Refresh Token은 보안 쿠키에 굽고
    this.setRefreshTokenCookie(res, tokenPair.refreshToken);

    // Access Token만 응답 Body로 반환
    return { accessToken: tokenPair.accessToken };
  }

  // 3. 로그아웃 API
  @ApiBearerAuth('access-token')
  @ApiDocOk('로그아웃', CoreOutput)
  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  async signOut(
    @CurrentUser() user: User,
    @Request() req: any,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const accessToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req) ?? '';
    this.clearRefreshTokenCookie(res);
    return this.authService.signOut(user.id, accessToken);
  }

  // 4. 토큰 갱신 API
  @ApiDocOk('토큰 갱신 (Refresh Token)', AccessTokenResponse)
  @Public() // AccessToken 만료 시 호출되므로 Public이어야 함
  @UseGuards(RefreshTokenGuard) // 대신 RefreshToken이 유효한지 검증하는 가드 사용
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentRefreshToken() refreshToken: string, // 쿠키에서 추출한 토큰
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    // 토큰 갱신 (RTR: Refresh Token Rotation)
    const tokenPair = await this.authService.refreshTokens(refreshToken);

    // 새로 발급된 Refresh Token을 다시 쿠키에 저장
    this.setRefreshTokenCookie(res, tokenPair.refreshToken);

    return { accessToken: tokenPair.accessToken };
  }

  @ApiExcludeEndpoint()
  @Public() // 로그인 없이 접근 가능해야 함
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return {
      message:
        '이메일 인증이 성공적으로 완료되었습니다. 이제 로그인할 수 있습니다.',
    };
  }
}

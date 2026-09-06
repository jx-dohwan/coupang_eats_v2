import { Global, Module } from '@nestjs/common';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';
import { TokenService } from './jwt.service';
import { UserRepositoryModule } from '../../modules/user/repository/user-repository.module';
import { RefreshTokenStrategy } from './refreshToken.strategy';
import { AccessTokenStrategy } from './accessToken.strategy';

@Global()
@Module({
  imports: [NestJwtModule.register({}), UserRepositoryModule],
  providers: [TokenService, AccessTokenStrategy, RefreshTokenStrategy],
  exports: [TokenService],
})
export class JwtModule {}

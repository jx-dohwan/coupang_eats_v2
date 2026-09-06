import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserRepositoryModule } from '../user/repository/user-repository.module'; // 경로 확인
import { HashModule } from '../../core/hash/hash.module';
import { CacheModule } from '../../core/cache/cache.module';
import { NotificationModule } from '../../core/notification/notification.module';
import { AuthTxService } from './auth.tx.service';

@Module({
  imports: [
    UserRepositoryModule, 
    HashModule,
    CacheModule,
    NotificationModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthTxService],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { UserRepositoryModule } from './repository/user-repository.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { HashModule } from '../../core/hash/hash.module';
import { CacheModule } from '../../core/cache/cache.module';

@Module({
  imports: [UserRepositoryModule, HashModule, CacheModule],
  controllers: [UserController],

  providers: [UserService],

  exports: [UserService, UserRepositoryModule],
})
export class UserModule {}

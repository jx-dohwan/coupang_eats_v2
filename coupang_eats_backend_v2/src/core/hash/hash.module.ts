import { Module } from '@nestjs/common';
import { BcryptService } from './bcrypt.service';
import { HASH_SERVICE } from './hash.interface';

@Module({
  // 커스텀 프로바이더 설정, HASH_SERVICE를 달라고 요청하면, 실제로는 BcryptService를 준다.
  providers: [
    {
      provide: HASH_SERVICE,
      useClass: BcryptService,
    },
  ],
  exports: [HASH_SERVICE],
})
export class HashModule {}

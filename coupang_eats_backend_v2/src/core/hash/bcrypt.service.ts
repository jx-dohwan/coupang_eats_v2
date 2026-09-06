import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IHashService } from './hash.interface';

@Injectable()
export class BcryptService implements IHashService {
  private readonly saltRounds = 10; // 해싱의 복잡도

  async hash(data: string): Promise<string> { // 비밀번호를 암호화하여 해시 문자열을 반환
    return bcrypt.hash(data, this.saltRounds);
  }

  async compare(data: string, hash: string): Promise<boolean> { // 입력받은 비밀번호가 저장된 해시와 일치하는지 검증
    return bcrypt.compare(data, hash);
  }
}

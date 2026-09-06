import { Injectable, ConflictException } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { UserRepository } from '../user/repository/user.repository';
import { SignUpBody } from './dto/request/signUp.body';

@Injectable()
export class AuthTxService {
  constructor(private readonly userRepository: UserRepository) {}

  @Transactional()
  async createUserOrThrow(
    body: SignUpBody,
    hashedPassword: string,
  ): Promise<void> {
    const { email } = body;

    if (await this.userRepository.findOneByFilters({ email })) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    await this.userRepository.save(body.toEntity(hashedPassword));
  }
}

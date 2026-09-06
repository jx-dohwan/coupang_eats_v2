import { IsString } from 'class-validator';
import { User } from '../../../../entities/user/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

export class SignInBody {
  @ApiProperty({
    description: '이메일',
    example: 'user@example.com',
  })
  @IsString()
  email: User['email'];

  @ApiProperty({
    description: '비밀번호',
    example: 'password1234!',
  })
  @IsString()
  password: User['password'];
}

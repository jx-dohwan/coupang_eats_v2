import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    description: '변경할 이름',
    example: '홍길동(개명)',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: '변경할 비밀번호 (입력 시 암호화되어 저장됨)',
    example: 'newPassword123!',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*[!@#$%^*+=-])(?=.*[0-9]).{8,15}$/, {
    message: '비밀번호는 영문, 숫자, 특수문자를 포함하여 8~15자여야 합니다.',
  })
  password?: string;
}

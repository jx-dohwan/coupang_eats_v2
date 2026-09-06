import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { User } from '../../entities/user/user.entity';
import { UserService } from './user.service';
import { AccessTokenGuard } from '../../core/guard/accessToken.guard';
import { ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ApiDocOk } from '../../core/decorator/swagger.decorator';
import { CurrentUser } from '../../core/decorator/currentUser.decorator';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Patch('profile')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiDocOk('내 정보 수정', User)
  @ApiOperation({ summary: '내 정보(이름, 비밀번호) 수정' })
  async updateProfile(
    @CurrentUser() user: User, // 토큰에서 내 정보 추출
    @Body() dto: UpdateUserDto,
  ) {
    return this.service.updateUser(user.id, dto);
  }

  @Get('/:userId')
  @UseGuards(AccessTokenGuard) // 1. 가드 적용 (로그인 필요 시)
  @ApiBearerAuth('access-token') // 2. Swagger 인증 버튼 활성화 (ApiDocOk에는 없어서 추가)
  @ApiDocOk('유저 상세 조회', User) // 3. 커스텀 데코레이터로 요약 및 응답 타입 정의
  @ApiParam({
    // 4. 파라미터 설명 추가
    name: 'userId',
    description: '조회할 유저의 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  async getUser(@Param('userId', ParseUUIDPipe) userId: User['id']) {
    return this.service.getUser(userId);
  }
}

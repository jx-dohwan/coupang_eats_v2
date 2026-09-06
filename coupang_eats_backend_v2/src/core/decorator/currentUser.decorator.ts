import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../entities/user/user.entity';

export const CurrentUser = createParamDecorator(
    // data: 데코레이터에 넘겨주는 인자(email등)
    // ctx: 현지 실행 컨텍스트(HTTP 요청, 응답 등 정보를 가짐)
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest(); // 실행 컨텍스트를 HTTP 모드로 전환하여 요청 객체를 가져옴
    const user = request.user; // 요청 객체에서 user 정보를 가져옴

    // 만약 인증된 유저 정보가 없다면 null을 반환함
    if (!user) {
      return null;
    }

    // 데코레이터 사용 시 특정 필드를 지정했다면 그 값만 반환하고, 지정하지 않았다면 user 객체 전체를 반환
    return data ? user[data] : user;
  },
);

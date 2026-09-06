import { ApiProperty } from '@nestjs/swagger';
import { CoreOutput } from '../../../../common/dto/core.output';

export class AccessTokenResponse extends CoreOutput {
  @ApiProperty({
    description: '발급된 액세스 토큰',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;
}

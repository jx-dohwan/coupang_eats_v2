import { ApiProperty } from '@nestjs/swagger';
import { CoreOutput } from '../../../common/dto/core.output';

export class UploadOutput extends CoreOutput {
  @ApiProperty({
    description: '업로드된 S3 이미지 URL',
    example:
      'https://my-bucket.s3.ap-northeast-2.amazonaws.com/restaurant/uuid.jpg',
  })
  url?: string;
}

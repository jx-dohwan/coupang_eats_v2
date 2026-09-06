import { ApiProperty } from '@nestjs/swagger';
import { CoreOutput } from '../../../common/dto/core.output';

export class MultiUploadOutput extends CoreOutput {
  @ApiProperty({
    description: '업로드된 이미지 URL 리스트',
    example: [
      'https://bucket.s3.region.amazonaws.com/dish/uuid1.jpg',
      'https://bucket.s3.region.amazonaws.com/dish/uuid2.jpg',
    ],
    type: [String], // Swagger에게 문자열 배열임을 알려줌
  })
  urls?: string[];
}

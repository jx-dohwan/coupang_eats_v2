import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { AwsModule } from '../../core/aws/aws.module'; // AwsS3Service를 export하고 있는 모듈

@Module({
  imports: [AwsModule],
  controllers: [UploadController],
})
export class UploadModule {}
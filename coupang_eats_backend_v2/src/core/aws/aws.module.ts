import { Global, Module } from '@nestjs/common';
import { AwsS3Service } from './aws-s3.service';
import { ConfigModule } from '@nestjs/config';
import { AwsSesService } from './aws-ses.service';

@Global() // CoreModule에서 import하면 전역으로 사용 가능하게 설정
@Module({
  imports: [ConfigModule],
  providers: [AwsS3Service, AwsSesService],
  exports: [AwsS3Service, AwsSesService], // 다른 모듈(Restaurant 등)에서 사용하기 위해 export
})
export class AwsModule {}

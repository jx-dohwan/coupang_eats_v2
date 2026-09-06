import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Configurations } from '../config';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AwsS3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly cdnUrl: string;

  constructor(private readonly configService: ConfigService<Configurations>) {
    this.bucketName = this.configService.getOrThrow('AWS.S3_BUCKET_NAME', {
      infer: true,
    });

    this.region = this.configService.getOrThrow('AWS.REGION', {
      infer: true,
    });

    // 인프라 AWS_CDN_URL (CloudFront). 로컬은 비워 두고 S3 URL fallback 가능
    this.cdnUrl =
      this.configService.get('AWS.CDN_URL', { infer: true })?.trim() || '';

    // Keyless: ECS Task Role / 로컬 AWS 자격증명
    this.s3Client = new S3Client({
      region: this.region,
    });
  }

  /**
   * 이미지를 S3에 업로드하고 공개 URL을 반환합니다.
   * CDN_URL이 있으면 CloudFront, 없으면 S3 직접 URL(로컬용).
   */
  async uploadImage(
    folder: string,
    file: Express.Multer.File,
  ): Promise<string> {
    try {
      const key = `${folder}/${this.generateFileName(file.originalname)}`;

      const parallelUploads3 = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        },
      });

      await parallelUploads3.done();

      return this.buildPublicUrl(key);
    } catch (error) {
      throw new InternalServerErrorException(
        `S3 Upload Failed: ${error.message}`,
      );
    }
  }

  async uploadImages(
    folder: string,
    files: Array<Express.Multer.File>,
  ): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadImage(folder, file));
    return Promise.all(uploadPromises);
  }

  /** 인프라 CloudFront OAC — 클라이언트는 CDN으로만 조회 */
  private buildPublicUrl(key: string): string {
    if (this.cdnUrl) {
      return `${this.cdnUrl}/${key}`;
    }
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private generateFileName(originalName: string): string {
    const ext = path.extname(originalName);
    return `${uuidv4()}${ext}`;
  }
}

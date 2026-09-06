// AuthService에서 사용하는 인터페이스 토큰 import (경로 확인 필요)
import { NOTIFICATION_SERVICE } from '../../src/core/notification/notification.interface';

export class MockAwsSesService {
  async sendEmail(to: string, subject: string, content: string) {
    console.log(`[MockSES] Email sent to ${to}`);
    return true;
  }

  // AuthService에서 (email, role, token) 순서로 호출함
  async sendWelcomeNotification(email: string, role: string, token: string) {
    console.log(
      `[MockSES] Welcome email sent to ${email} (Role: ${role}, Token: ${token})`,
    );
    return true;
  }
}

export class MockAwsS3Service {
  async uploadFile(file: any) {
    return 'https://mock-s3-url.com/image.jpg';
  }

  async deleteFile(key: string) {
    return true;
  }
}

// 실제 테스트 파일에서 사용할 Provider 정의
export const mockAwsProviders = [
  {
    provide: NOTIFICATION_SERVICE, // ✅ AwsSesService 클래스 대신 토큰 사용
    useClass: MockAwsSesService,
  },
  // S3는 보통 Service 클래스 자체를 주입받으므로 그대로 둡니다. (만약 interface면 토큰으로 변경)
  // { provide: AwsS3Service, useClass: MockAwsS3Service }
];

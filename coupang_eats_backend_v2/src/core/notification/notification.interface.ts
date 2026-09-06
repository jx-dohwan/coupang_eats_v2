// [설계도] 모든 알림 서비스(이메일, SMS 등)가 반드시 구현해야 할 공통 인터페이스
export interface INotificationService {
    /** 회원가입 환영 알림 발송 */
    sendWelcomeNotification(email: string, nickname: string, token: string): Promise<void>;
  }
  
  // [DI 토큰] 인터페이스는 런타임에 사라지므로, NestJS가 식별할 수 있는 문자열 토큰을 정의
  // @Inject(NOTIFICATION_SERVICE) 형태로 주입받기 위함
  export const NOTIFICATION_SERVICE = 'NOTIFICATION_SERVICE';
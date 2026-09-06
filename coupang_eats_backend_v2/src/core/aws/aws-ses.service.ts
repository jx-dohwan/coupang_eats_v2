import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { NodeHttpHandler } from '@smithy/node-http-handler'; // 👈 필수: npm install @smithy/node-http-handler
import { MoinConfigService } from '../config/config.service';

@Injectable()
export class AwsSesService {
  private readonly sesClient: SESClient;
  private readonly senderEmail: string;

  constructor(private readonly configService: MoinConfigService) {
    const awsConfig = this.configService.getAwsConfig();
    this.senderEmail = awsConfig.SES_SENDER_EMAIL;

    this.sesClient = new SESClient({
      region: awsConfig.REGION,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 3000,
        socketTimeout: 5000,
      }),
      endpoint: `https://email.${awsConfig.REGION}.amazonaws.com`,
    });
  }

  async sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
    try {
      console.log(`[SES-DEBUG] 발송 시도: To(${to})`);

      const command = new SendEmailCommand({
        Source: this.senderEmail,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: htmlBody, Charset: 'UTF-8' } },
        },
      });

      await this.sesClient.send(command);
      console.log(`[SES-DEBUG] 발송 성공!`);
    } catch (error) {
      console.error('SES Error 상세 로그:', {
        name: error.name,
        message: error.message,
        code: error.$metadata?.httpStatusCode,
      });
      throw new InternalServerErrorException(`SES 실패: ${error.message}`);
    }
  }
}
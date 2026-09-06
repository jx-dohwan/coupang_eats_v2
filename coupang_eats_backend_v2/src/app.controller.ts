import { Controller, Get } from '@nestjs/common';
import { Public } from './core/decorator/public.decorator';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  /** ALB Target Group health check — infra: health_check_path = "/health" */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'ALB / 컨테이너 헬스체크' })
  health(): { status: string } {
    return { status: 'ok' };
  }

  /** 하위 호환 (로컬·구 헬스체크). ALB는 /health 사용 */
  @Public()
  @Get()
  @ApiExcludeEndpoint()
  root(): string {
    return 'OK';
  }
}

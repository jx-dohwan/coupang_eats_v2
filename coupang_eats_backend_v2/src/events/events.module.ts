import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Global() // 어디서든 쓸 수 있게 Global로 선언
@Module({
  providers: [EventsGateway],
  exports: [EventsGateway], // OrderService에서 주입받기 위해 export 필수
})
export class EventsModule {}

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // console.log(`Client disconnected: ${client.id}`);
  }

  // 1. 사용자별 방 입장 (Owner 알림용)
  @SubscribeMessage('joinUserRoom')
  handleJoinUserRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number; role: string },
  ) {
    const roomName = `${data.role}:${data.userId}`;
    client.join(roomName);
  }

  // 2. 주문별 방 입장 (상태 업데이트 및 위치 추적용)
  @SubscribeMessage('joinOrderRoom')
  handleJoinOrderRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: number },
  ) {
    const roomName = `order:${data.orderId}`;
    client.join(roomName);
  }

  // 3. 배달원 위치 실시간 중계 (DB 저장 X, 소켓으로만 전달)
  // 프론트엔드에서 구글 지도로 얻은 좌표를 이 이벤트로 쏘면 됩니다.
  @SubscribeMessage('updateDriverLocation')
  handleDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: number; lat: number; lng: number },
  ) {
    const roomName = `order:${data.orderId}`;
    // 해당 주문 방에 있는 사람(고객)에게만 좌표 전송
    client.to(roomName).emit('driverLocation', {
      lat: data.lat,
      lng: data.lng,
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderRepository } from './repository/order.repository';
import { OrderStatus } from '../../common/type/common.interface';
import { LessThan } from 'typeorm';

@Injectable()
export class OrderCronService {
  private readonly logger = new Logger(OrderCronService.name);

  constructor(private readonly orderRepository: OrderRepository) {}

  // 매일 새벽 4시 실행
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleCron() {
    this.logger.debug('Running cron: Cleaning up stale orders...');

    // 24 시간 지난 Pending 주문 삭제
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const result = await this.orderRepository.delete({
      status: OrderStatus.Pending,
      createdAt: LessThan(yesterday),
    });

    this.logger.debug(`Deleted ${result.affected} stale orders.`);
  }
}

import { Injectable } from '@nestjs/common';
import { GenericTypeOrmRepository } from '../../../core/database/typeorm/generic-typeorm.repository';
import { OrderEntity } from '../../../entities/order/order.entity';
import { CustomRepository } from '../../../../libs/common/typeorm.ex/typeorm-ex.decorator';

@CustomRepository(OrderEntity)
export class OrderRepository extends GenericTypeOrmRepository<OrderEntity> {}

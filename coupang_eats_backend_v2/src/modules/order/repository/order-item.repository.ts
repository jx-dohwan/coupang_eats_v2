import { Injectable } from '@nestjs/common';
import { GenericTypeOrmRepository } from '../../../core/database/typeorm/generic-typeorm.repository';
import { OrderItemEntity } from '../../../entities/order/order-item.entity';
import { DataSource } from 'typeorm';
import { CustomRepository } from '../../../../libs/common/typeorm.ex/typeorm-ex.decorator';

@CustomRepository(OrderItemEntity)
export class OrderItemRepository extends GenericTypeOrmRepository<OrderItemEntity> {}

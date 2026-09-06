import { Injectable } from '@nestjs/common';
import { GenericTypeOrmRepository } from '../../../core/database/typeorm/generic-typeorm.repository';
import { PaymentEntity } from '../../../entities/payment/payment.entity';
import { CustomRepository } from '../../../../libs/common/typeorm.ex/typeorm-ex.decorator';

@CustomRepository(PaymentEntity)
export class PaymentRepository extends GenericTypeOrmRepository<PaymentEntity> {}

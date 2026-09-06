import { Injectable } from '@nestjs/common';
import { GenericTypeOrmRepository } from '../../../core/database/typeorm/generic-typeorm.repository';
import { ReviewEntity } from '../../../entities/review/review.entity';
import { DataSource } from 'typeorm';
import { CustomRepository } from '../../../../libs/common/typeorm.ex/typeorm-ex.decorator';

@CustomRepository(ReviewEntity)
export class ReviewRepository extends GenericTypeOrmRepository<ReviewEntity> {}

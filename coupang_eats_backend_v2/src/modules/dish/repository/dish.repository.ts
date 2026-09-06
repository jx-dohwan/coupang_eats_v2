import { Injectable } from '@nestjs/common';
import { GenericTypeOrmRepository } from '../../../core/database/typeorm/generic-typeorm.repository';
import { DishEntity } from '../../../entities/dish/dish.entity';
import { DataSource } from 'typeorm';
import { CustomRepository } from '../../../../libs/common/typeorm.ex/typeorm-ex.decorator';

@CustomRepository(DishEntity)
export class DishRepository extends GenericTypeOrmRepository<DishEntity> {}

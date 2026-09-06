import { Injectable } from '@nestjs/common';
import { GenericTypeOrmRepository } from '../../../core/database/typeorm/generic-typeorm.repository';
import { RestaurantEntity } from '../../../entities/restaurant/restaurant.entity';
import { DataSource } from 'typeorm';
import { CustomRepository } from '../../../../libs/common/typeorm.ex/typeorm-ex.decorator';

@CustomRepository(RestaurantEntity)
export class RestaurantRepository extends GenericTypeOrmRepository<RestaurantEntity> {}

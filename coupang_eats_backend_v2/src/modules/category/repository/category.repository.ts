import { Injectable } from '@nestjs/common';
import { GenericTypeOrmRepository } from '../../../core/database/typeorm/generic-typeorm.repository';
import { CategoryEntity } from '../../../entities/category/category.entity';
import { DataSource } from 'typeorm';
import { CustomRepository } from '../../../../libs/common/typeorm.ex/typeorm-ex.decorator';

@CustomRepository(CategoryEntity)
export class CategoryRepository extends GenericTypeOrmRepository<CategoryEntity> {}

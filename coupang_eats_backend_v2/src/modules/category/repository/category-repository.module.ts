import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '../../../../libs/common/typeorm.ex/typeorm-ex.module';
import { CategoryRepository } from './category.repository';

@Module({
  imports: [TypeOrmExModule.forCustomRepository([CategoryRepository])],
  exports: [TypeOrmExModule.forCustomRepository([CategoryRepository])],
})
export class CategoryRepositoryModule {}

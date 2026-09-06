import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { CategoryRepositoryModule } from './repository/category-repository.module';

@Module({
  imports: [CategoryRepositoryModule],
  controllers: [CategoryController],

  providers: [CategoryService],

  exports: [CategoryRepositoryModule],
})
export class CategoryModule {}

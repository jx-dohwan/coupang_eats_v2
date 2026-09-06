import { ConflictException, Injectable } from '@nestjs/common';
import { CategoryRepository } from './repository/category.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryEntity } from '../../entities/category/category.entity';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async createCategory(dto: CreateCategoryDto): Promise<CategoryEntity> {
    // 1. 변환: DTO가 스스로 엔티티 객체로 변신 (슬러그 생성됨)
    const category = dto.toEntity();

    // 2. 중복 체크: 변환된 엔티티 안에 있는 slug를 사용
    const existing = await this.categoryRepository.findOneByFilters({
      slug: category.slug,
    });

    if (existing) {
      throw new ConflictException('Category already exists');
    }

    // 3. 저장: 이미 엔티티 객체이므로 create 없이 바로 save
    return this.categoryRepository.save(category);
  }

  async getAllCategories() {
    return this.categoryRepository.findAll();
  }
}

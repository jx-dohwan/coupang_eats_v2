import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from './category.service';
import { CategoryRepository } from './repository/category.repository';
import { ConflictException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryEntity } from '../../entities/category/category.entity';

// 1. Mock Repository 정의
const mockCategoryRepository = {
  findOneByFilters: jest.fn(),
  save: jest.fn(),
  findAll: jest.fn(),
};

describe('CategoryService', () => {
  let service: CategoryService;
  let repository: typeof mockCategoryRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: CategoryRepository,
          useValue: mockCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    repository = module.get(CategoryRepository);

    // 각 테스트 실행 전 Mock 초기화
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCategory', () => {
    // DTO Mocking: toEntity 메서드가 포함되어야 함
    const createDto = {
      name: 'Korean Food',
      coverImg: 'img.jpg',
      toEntity: jest.fn(),
    } as unknown as CreateCategoryDto;

    it('중복된 카테고리가 없으면 생성에 성공해야 한다', async () => {
      // Arrange
      const categoryEntity = { slug: 'korean-food' } as CategoryEntity;

      // Mock Setup
      (createDto.toEntity as jest.Mock).mockReturnValue(categoryEntity);
      repository.findOneByFilters.mockResolvedValue(null); // 중복 없음
      repository.save.mockResolvedValue(categoryEntity); // 저장 성공

      // Act
      const result = await service.createCategory(createDto);

      // Assert
      expect(createDto.toEntity).toHaveBeenCalled(); // 1. 변환 호출 확인
      expect(repository.findOneByFilters).toHaveBeenCalledWith({
        slug: 'korean-food',
      }); // 2. 중복 체크 호출 확인
      expect(repository.save).toHaveBeenCalledWith(categoryEntity); // 3. 저장 호출 확인
      expect(result).toEqual(categoryEntity);
    });

    it('이미 존재하는 슬러그라면 ConflictException을 던져야 한다', async () => {
      // Arrange
      const categoryEntity = { slug: 'korean-food' } as CategoryEntity;

      // Mock Setup
      (createDto.toEntity as jest.Mock).mockReturnValue(categoryEntity);
      repository.findOneByFilters.mockResolvedValue(categoryEntity); // 이미 존재함!

      // Act & Assert
      await expect(service.createCategory(createDto)).rejects.toThrow(
        ConflictException,
      );

      // 검증: save는 호출되지 않아야 함
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getAllCategories', () => {
    it('전체 카테고리 목록을 반환해야 한다', async () => {
      // Arrange
      const categories = [{ name: 'Cat1' }, { name: 'Cat2' }];
      repository.findAll.mockResolvedValue(categories);

      // Act
      const result = await service.getAllCategories();

      // Assert
      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toEqual(categories);
    });
  });
});

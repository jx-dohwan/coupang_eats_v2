import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CategoryEntity } from '../../../entities/category/category.entity';
import { plainToInstance } from 'class-transformer';

export class CreateCategoryDto {
  @ApiProperty({
    description: '카테고리 이름',
    example: '치킨',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: '커버 이미지 URL',
    example: 'https://image.url/chicken.png',
    required: false,
  })
  @IsString()
  @IsOptional()
  coverImg?: string;

  toEntity(): CategoryEntity {
    return plainToInstance(CategoryEntity, {
      ...this,
      // 슬러그 생성 로직을 DTO 내부로 갭슐화
      slug: this.name.trim().toLowerCase().replace(/ /g, '-'),
    });
  }
}

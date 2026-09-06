import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DishEntity } from '../../../entities/dish/dish.entity';

export class DishOptionDto {
  @ApiProperty({ description: '옵션 이름', example: '치즈 추가' })
  @IsString()
  name: string;

  @ApiProperty({ description: '추가 금액', example: 1000 })
  @IsNumber()
  extra: number;
}

export class CreateDishDto {
  @ApiProperty({ description: '메뉴 이름', example: '후라이드 치킨' })
  @IsString()
  name: string;

  @ApiProperty({ description: '가격', example: 18000 })
  @IsNumber()
  price: number;

  @ApiProperty({ description: '설명', example: '바삭바삭해요' })
  @IsString()
  description: string;

  @ApiProperty({ description: '사진 URL', required: false })
  @IsString()
  @IsOptional()
  photo?: string;

  @ApiProperty({
    description: '메뉴 옵션 목록',
    type: [DishOptionDto], // 배열 타입임을 알려줌
    required: false,
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DishOptionDto)
  options?: DishOptionDto[];

  toEntity(restaurantId: string): DishEntity {
    const entity = plainToInstance(DishEntity, this);
    // 외래키 주입
    entity.restaurantId = restaurantId;

    return entity;
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { RestaurantEntity } from '../../../entities/restaurant/restaurant.entity';
import { plainToInstance } from 'class-transformer';

export class CreateRestaurantDto {
  @ApiProperty({ description: '식당 이름', example: 'BBQ 서초점' })
  @IsString()
  name: string;

  @ApiProperty({ description: '커버 이미지 URL', example: 'https://...' })
  @IsString()
  coverImg: string;

  @ApiProperty({ description: '주소', example: '서울시 서초구...' })
  @IsString()
  address: string;

  @ApiProperty({
    description: '카테고리 ID (UUID)',
    example: 'category-uuid-1234',
  })
  @IsString()
  categoryId: string;

  @ApiProperty({ description: '배달비', example: 2500 })
  @IsNumber()
  deliveryFee: number;

  @ApiProperty({ description: '최소 주문 금액', example: 12000 })
  @IsNumber()
  minimumPrice: number;

  toEntity(ownerId: string): RestaurantEntity {
    const entity = plainToInstance(RestaurantEntity, this);

    entity.ownerId = ownerId;

    return entity;
  }
}

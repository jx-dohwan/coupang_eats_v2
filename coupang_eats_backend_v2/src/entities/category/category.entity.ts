import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { UuidEntity } from '../../core/database/typeorm/base.entity';
import { RestaurantEntity } from '../restaurant/restaurant.entity';
import { User } from '../user/user.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('category')
export class CategoryEntity extends UuidEntity {
  @ApiProperty({description:'카테고리 이름', example:'한식'})
  @Column({ unique: true })
  name: string;

  @ApiProperty({description:'커버 이미지', nullable: true})
  @Column({ nullable: true })
  coverImg: string;

  @ApiProperty({description:'카테고리 슬러그 (자동 생성)', example: 'korean-food'})
  @Column({ unique: true })
  slug: string;

  @OneToMany(() => RestaurantEntity, (restaurant) => restaurant.category)
  restaurants: RestaurantEntity[];
}

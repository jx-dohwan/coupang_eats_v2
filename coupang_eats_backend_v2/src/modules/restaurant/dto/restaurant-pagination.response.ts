import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../../common/pagination/pagination.response.dto';
import { RestaurantEntity } from '../../../entities/restaurant/restaurant.entity';

export class RestaurantPaginationResponse extends PaginationResponseDto<RestaurantEntity> {
  @ApiProperty({
    type: [RestaurantEntity],
    description: '식당 목록 데이터',
  })
  declare data: RestaurantEntity[];
}

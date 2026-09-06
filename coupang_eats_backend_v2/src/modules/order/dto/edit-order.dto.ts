import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../../common/type/common.interface';
import { ApiProperty } from '@nestjs/swagger';

export class EditOrderDto {
  @ApiProperty({
    description: '변경할 주문 상태',
    enum: OrderStatus,
    example: OrderStatus.Cooking,
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

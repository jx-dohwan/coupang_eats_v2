import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { AccessTokenGuard } from '../../core/guard/accessToken.guard';
import { RolesGuard } from '../../core/guard/roles.guard';
import { Roles } from '../../core/decorator/roles.decorator';
import { Role } from '../../entities/user/user.interface';
import { CurrentUser } from '../../core/decorator/currentUser.decorator';
import { User } from '../../entities/user/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { EditOrderDto } from './dto/edit-order.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiDocCreated, ApiDocOk } from '../../core/decorator/swagger.decorator';
import { OrderEntity } from '../../entities/order/order.entity';

@ApiTags('Order (주문)')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiDocCreated('주문 생성', OrderEntity)
  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CLIENT)
  async createOrder(
    @CurrentUser() user: User,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.orderService.createOrder(user, createOrderDto);
  }

  @ApiDocOk('주문 목록 조회 (본인 관련)', [OrderEntity])
  @Get()
  @UseGuards(AccessTokenGuard)
  async getOrders(@CurrentUser() user: User) {
    return this.orderService.getOrders(user);
  }

  @ApiDocOk('주문 상세 조회', OrderEntity)
  @Get(':id')
  @UseGuards(AccessTokenGuard)
  async getOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orderService.getOrderById(user, id);
  }

  @ApiDocCreated('주문 상태 변경', OrderEntity) // Patch지만 DB 저장(수정)이므로 Created 스타일 사용 가능
  @Patch(':id')
  @UseGuards(AccessTokenGuard)
  async editOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() editOrderDto: EditOrderDto,
  ) {
    return this.orderService.editOrderStatus(user, id, editOrderDto);
  }
}

import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DishService } from './dish.service';
import { AccessTokenGuard } from '../../core/guard/accessToken.guard';
import { RolesGuard } from '../../core/guard/roles.guard';
import { Roles } from '../../core/decorator/roles.decorator';
import { Role } from '../../entities/user/user.interface';
import { CurrentUser } from '../../core/decorator/currentUser.decorator';
import { User } from '../../entities/user/user.entity';
import { CreateDishDto } from './dto/create-dish.dto';
import { ApiTags } from '@nestjs/swagger';
import {
  ApiDocCreated,
  ApiDocOk,
} from '../../core/decorator/swagger.decorator';
import { DishEntity } from '../../entities/dish/dish.entity';
import { CoreOutput } from '../../common/dto/core.output';
import { UpdateDishDto } from './dto/update-dish.dto';

@ApiTags('Dish (메뉴)')
@Controller()
export class DishController {
  constructor(private readonly dishService: DishService) {}

  /**
   * 메뉴 생성
   * URL: POST /restaurants/:restaurantId/dishes
   * 점주만 가능하며, Service 내부에서 본인 식당인지 한 번 더 체크함
   */
  @ApiDocCreated('메뉴 생성', DishEntity)
  @Post('restaurants/:restaurantId/dishes')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.OWNER)
  async createDish(
    @CurrentUser() owner: User,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() createDishDto: CreateDishDto,
  ) {
    return this.dishService.createDish(owner, restaurantId, createDishDto);
  }

  /**
   * 메뉴 수정
   * URL: PATCH /restaurants/:restaurantId/dishes/:id
   */
  @ApiDocOk('메뉴 수정', DishEntity)
  @Patch('restaurants/:restaurantId/dishes/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.OWNER)
  async updateDish(
    @CurrentUser() owner: User,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('id', ParseUUIDPipe) dishId: string,
    @Body() updateDishDto: UpdateDishDto,
  ) {
    // 2. 서비스 호출
    return this.dishService.updateDish(
      owner,
      restaurantId,
      dishId,
      updateDishDto,
    );
  }

  /**
   * 메뉴 삭제
   * URL: DELETE /dishes/:id
   */
  @ApiDocOk('메뉴 삭제', CoreOutput)
  @Delete('dishes/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.OWNER)
  async deleteDish(
    @CurrentUser() owner: User,
    @Param('id', ParseUUIDPipe) dishId: string,
  ) {
    return this.dishService.deleteDish(owner, dishId);
  }
}

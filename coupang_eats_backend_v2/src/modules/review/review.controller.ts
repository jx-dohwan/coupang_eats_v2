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
import { ReviewService } from './review.service';
import { AccessTokenGuard } from '../../core/guard/accessToken.guard';
import { RolesGuard } from '../../core/guard/roles.guard';
import { Roles } from '../../core/decorator/roles.decorator';
import { Role } from '../../entities/user/user.interface';
import { CurrentUser } from '../../core/decorator/currentUser.decorator';
import { User } from '../../entities/user/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { ApiTags } from '@nestjs/swagger';
import {
  ApiDocCreated,
  ApiDocOk,
} from '../../core/decorator/swagger.decorator';
import { ReviewEntity } from '../../entities/review/review.entity';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CoreOutput } from '../../common/dto/core.output';

@ApiTags('Review (리뷰)')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @ApiDocCreated('리뷰 작성', ReviewEntity)
  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CLIENT)
  async createReview(
    @CurrentUser() user: User,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewService.createReview(user, createReviewDto);
  }

  @ApiDocOk('리뷰 수정', ReviewEntity)
  @Patch(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CLIENT)
  async updateReview(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) reviewId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewService.updateReview(user, reviewId, dto);
  }

  @ApiDocOk('리뷰 삭제', CoreOutput)
  @Delete(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CLIENT)
  async deleteReview(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) reviewId: string,
  ) {
    return this.reviewService.deleteReview(user, reviewId);
  }
}

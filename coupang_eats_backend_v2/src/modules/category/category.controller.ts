import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Public } from '../../core/decorator/public.decorator';
import { AccessTokenGuard } from '../../core/guard/accessToken.guard';
import {
  ApiDocCreated,
  ApiDocOk,
} from '../../core/decorator/swagger.decorator';
import { CategoryEntity } from '../../entities/category/category.entity';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Category (카테고리)')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @ApiDocCreated('카테고리 생성', CategoryEntity)
  @Post()
  @UseGuards(AccessTokenGuard) // 로그인한 사람만 생성 가능
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.createCategory(createCategoryDto);
  }

  @ApiDocOk('전체 카테고리 조회', [CategoryEntity])
  @Public() // 비로그인 유저도 조회 가능
  @Get()
  async getAllCategories() {
    return this.categoryService.getAllCategories();
  }
}

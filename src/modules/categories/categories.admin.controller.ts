import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CategoriesService } from './categories.service';
import { AdjustWeightDto, CreateCategoryDto, UpdateCategoryDto } from './dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.listTree();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create({
      name: dto.name,
      weight: dto.weight,
      parentId: dto.parentId ?? undefined,
    });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Patch(':id/weight')
  adjustWeight(@Param('id') id: string, @Body() dto: AdjustWeightDto) {
    return this.categories.adjustWeight(id, dto.delta);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}

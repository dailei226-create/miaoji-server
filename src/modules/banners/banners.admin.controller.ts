import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BannersService } from './banners.service';
import { CreateBannerDto, UpdateBannerDto, BannerPosition } from './dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/banners')
export class AdminBannersController {
  constructor(private banners: BannersService) {}

  /** 获取 Banner 列表（按 position + sortOrder） */
  @Get()
  async list(@Query('position') position?: BannerPosition) {
    return this.banners.listAdmin(position);
  }

  /** 新增 Banner */
  @Post()
  async create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  /** 编辑 Banner */
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(Number(id), dto);
  }

  /** 启用 / 停用 Banner */
  @Patch(':id/enabled')
  async setEnabled(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.banners.setEnabled(Number(id), body.enabled);
  }

  /** 更新排序 */
  @Patch(':id/sort')
  async updateSort(@Param('id') id: string, @Body() body: { sortOrder: number }) {
    return this.banners.updateSort(Number(id), body.sortOrder);
  }

  /** 删除 Banner */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.banners.remove(Number(id));
  }
}

import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { WorksService } from './works.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReviewDecisionDto, UpdateWorkWeightDto, UpdateWorkDiscountDto, OfflineWorkDto } from './dto';
import { Request } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/works')
export class AdminWorksController {
  constructor(private works: WorksService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.works.adminList({ q, status, page: Number(page), pageSize: Number(pageSize) });
  }

  @Post('approve')
  async approve(@Body() dto: ReviewDecisionDto) {
    return this.works.adminApprove(dto.workId);
  }

  @Post(':id/approve')
  async approveById(@Param('id') id: string) {
    return this.works.adminApprove(id);
  }

  @Post('reject')
  async reject(@Body() dto: ReviewDecisionDto) {
    return this.works.adminReject(dto.workId, dto.reason);
  }

  @Post(':id/reject')
  async rejectById(@Param('id') id: string, @Body() dto: ReviewDecisionDto) {
    return this.works.adminReject(id, dto.reason);
  }

  @Put(':id/weight')
  async updateWeight(@Param('id') id: string, @Body() dto: UpdateWorkWeightDto) {
    return this.works.adminUpdateWeight(id, dto.weight);
  }

  @Put(':id/discount')
  async updateDiscount(@Param('id') id: string, @Body() dto: UpdateWorkDiscountDto) {
    return this.works.adminUpdateDiscount(id, dto);
  }

  // ========== 已上架作品管理（新增，不影响审核流程） ==========

  /** 获取已上架作品列表 */
  @Get('online')
  async listOnline(
    @Query('keyword') keyword?: string,
    @Query('authorId') authorId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.works.adminListOnline({
      keyword,
      authorId,
      categoryId,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    });
  }

  /** 设置作品权重 */
  @Patch(':id/weight')
  async setWeight(@Param('id') id: string, @Body() dto: UpdateWorkWeightDto) {
    return this.works.adminUpdateWeight(id, dto.weight);
  }

  /** 运营下架作品 */
  @Patch(':id/offline')
  async offlineWork(
    @Param('id') id: string,
    @Body() dto: OfflineWorkDto,
    @Req() req: Request,
  ) {
    const adminId = (req as any).user?.sub || null;
    return this.works.adminOfflineWork(id, dto.reason, adminId);
  }
}

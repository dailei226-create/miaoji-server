import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrdersService } from './orders.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private orders: OrdersService) {}

  // 订单列表（支持筛选）
  @Get()
  async list(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orders.adminList({
      status,
      q,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  // 订单详情
  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.orders.adminDetail(id);
  }

  // 关闭订单
  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Request() req: any,
  ) {
    const adminId = req.user?.userId || req.user?.id;
    return this.orders.adminCancel(id, body.note, adminId);
  }

  // 发货
  @Post(':id/ship')
  async ship(
    @Param('id') id: string,
    @Body() body: { expressCompany?: string; expressNo?: string; note?: string },
    @Request() req: any,
  ) {
    const adminId = req.user?.userId || req.user?.id;
    return this.orders.adminShip(id, body, adminId);
  }

  // 完成订单
  @Post(':id/complete')
  async complete(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Request() req: any,
  ) {
    const adminId = req.user?.userId || req.user?.id;
    return this.orders.adminComplete(id, body.note, adminId);
  }

  // 发起退款申请
  @Post(':id/refund/request')
  async refundRequest(
    @Param('id') id: string,
    @Body() body: { reason?: string; note?: string },
    @Request() req: any,
  ) {
    const adminId = req.user?.userId || req.user?.id;
    return this.orders.adminRefundRequest(id, body, adminId);
  }

  // 同意退款
  @Post(':id/refund/approve')
  async refundApprove(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Request() req: any,
  ) {
    const adminId = req.user?.userId || req.user?.id;
    return this.orders.adminRefundApprove(id, body.note, adminId);
  }

  // 拒绝退款
  @Post(':id/refund/reject')
  async refundReject(
    @Param('id') id: string,
    @Body() body: { reason: string; note?: string },
    @Request() req: any,
  ) {
    const adminId = req.user?.userId || req.user?.id;
    return this.orders.adminRefundReject(id, body, adminId);
  }

  // 执行退款（本期禁用）
  @Post(':id/refund/execute')
  async refundExecute(@Param('id') id: string) {
    return this.orders.adminRefundExecute(id);
  }

  // 更新运营备注
  @Post(':id/note')
  async updateNote(
    @Param('id') id: string,
    @Body() body: { note: string },
    @Request() req: any,
  ) {
    const adminId = req.user?.userId || req.user?.id;
    return this.orders.adminUpdateNote(id, body.note, adminId);
  }
}

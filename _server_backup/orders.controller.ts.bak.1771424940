import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrdersService } from './orders.service';
import { Request } from 'express';
import { CreateOrderDto, MockPayDto } from './dto';

// 环境检查：仅允许开发环境使用 mock 接口
const isDev = process.env.NODE_ENV !== 'production';

type AuthRequest = Request & { user?: { sub?: string } };

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  async create(@Req() req: AuthRequest, @Body() dto: CreateOrderDto) {
    const userId = req.user?.sub as string;
    return this.orders.create(userId, dto);
  }

  @Post('mock-pay')
  async mockPay(@Req() req: AuthRequest, @Body() dto: MockPayDto) {
    // 非开发环境禁止调用 mock-pay
    if (!isDev) {
      throw new ForbiddenException('mock-pay is only available in development environment');
    }
    const userId = req.user?.sub as string;
    return this.orders.mockPay(userId, dto.orderId);
  }

  @Post(':id/mock-pay')
  async mockPayById(@Req() req: AuthRequest, @Param('id') id: string) {
    // 非开发环境禁止调用 mock-pay
    if (!isDev) {
      throw new ForbiddenException('mock-pay is only available in development environment');
    }
    const userId = req.user?.sub as string;
    return this.orders.mockPay(userId, id);
  }

  @Post(':id/cancel')
  async cancel(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user?.sub as string;
    return this.orders.cancel(userId, id);
  }

  // 列表：先按买家角色返回（MVP）
  @Get()
  async list(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    return this.orders.listBuyer(userId);
  }

  @Get('me')
  async myBuyerOrders(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    return this.orders.listBuyer(userId);
  }

  // 最小查询：根据 userId 查询订单列表
  @Get('user/:userId')
  async listByUser(@Param('userId') userId: string) {
    return this.orders.listByUser(userId);
  }

  // 卖家发货（小程序创作者端使用）
  @Post(':id/ship')
  async markShipped(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { expressCompany?: string; expressNo?: string }
  ) {
    const userId = req.user?.sub as string;
    return this.orders.markShipped(userId, id, body.expressCompany, body.expressNo);
  }

  // 占位：售后中
  @Post(':id/after-sale')
  async markAfterSale(@Param('id') id: string) {
    return this.orders.markAfterSale(id);
  }

  // 确认收货（买家）
  @Post(':id/confirm-receipt')
  async confirmReceipt(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user?.sub as string;
    return this.orders.confirmReceipt(userId, id);
  }

  // 申请退款/退货退款（买家）
  @Post(':id/request-refund')
  async requestRefund(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string; type?: 'refund' | 'return_refund' }
  ) {
    const userId = req.user?.sub as string;
    return this.orders.requestRefund(userId, id, body.reason, body.type);
  }

  @Get('seller')
  async mySellerOrders(@Req() req: AuthRequest, @Query('status') status?: string) {
    const userId = req.user?.sub as string;
    return this.orders.listSeller(userId, status);
  }

  @Get(':id')
  async detail(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user?.sub as string;
    return this.orders.detail(userId, id);
  }
}

// MVP一期-前端对接：小程序直连接口=/orders,/orders/me,/orders/user/:userId,/orders/:id/ship,/orders/:id/after-sale

import { Controller, Get, Post, Patch, Param, Query, Body, Req, UseGuards, Header } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupportService } from './support.service';
import { SendMessageDto, UpdateTicketStatusDto } from './dto';

type AuthRequest = Request & { user?: { sub?: string } };

@Controller('admin/support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSupportController {
  constructor(private support: SupportService) {}

  /** 获取 ticket 列表 */
  @Get('tickets')
  @Header('Cache-Control', 'no-store')
  async listTickets(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.support.listTickets({
      status,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    });
  }

  /** 获取 ticket 消息列表（管理员不限制 userId） */
  @Get('tickets/:id/messages')
  @Header('Cache-Control', 'no-store')
  async getMessages(@Param('id') id: string) {
    return this.support.getMessages(id);
  }

  /** 管理员回复消息 */
  @Post('tickets/:id/messages')
  async sendMessage(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const adminId = req.user?.sub || null;
    return this.support.sendAdminMessage(id, adminId, dto.content);
  }

  /** 更新 ticket 状态 */
  @Patch('tickets/:id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.support.updateTicketStatus(id, dto.status);
  }
}

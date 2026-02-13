import { Controller, Get, Post, Param, Body, Req, UseGuards, Header } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SupportService } from './support.service';
import { SendMessageDto } from './dto';

type AuthRequest = Request & { user?: { sub?: string } };

@Controller('support')
export class SupportController {
  constructor(private support: SupportService) {}

  /** 创建或获取当前 OPEN ticket */
  @UseGuards(JwtAuthGuard)
  @Post('tickets')
  async createOrGetTicket(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    return this.support.getOrCreateTicket(userId);
  }

  /** 获取我当前的 ticket */
  @UseGuards(JwtAuthGuard)
  @Get('tickets/me')
  async getMyTicket(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    return this.support.getUserTicket(userId);
  }

  /** 获取 ticket 消息列表 */
  @UseGuards(JwtAuthGuard)
  @Get('tickets/:id/messages')
  @Header('Cache-Control', 'no-store')
  async getMessages(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user?.sub as string;
    return this.support.getMessages(id, userId);
  }

  /** 发送消息 */
  @UseGuards(JwtAuthGuard)
  @Post('tickets/:id/messages')
  async sendMessage(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const userId = req.user?.sub as string;
    return this.support.sendUserMessage(id, userId, dto.content);
  }
}

import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatorsService } from './creators.service';
import { PrismaService } from '../prisma/prisma.service';

type AuthRequest = Request & { user?: { sub?: string } };

// 脱敏工具函数
function maskIdCard(id: string | null): string {
  if (!id || id.length < 10) return id || '';
  return id.slice(0, 4) + '**********' + id.slice(-4);
}
function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 7) return phone || '';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}
function maskCard(card: string | null): string {
  if (!card || card.length < 8) return card || '';
  return card.slice(0, 4) + '********' + card.slice(-4);
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/creators')
export class AdminCreatorsController {
  constructor(private creators: CreatorsService, private prisma: PrismaService) {}

  @Get()
  async list(@Query('status') status?: string, @Query('q') q?: string) {
    return this.creators.adminList(status, q);
  }

  @Get(':userId')
  async detail(@Param('userId') userId: string) {
    return this.creators.adminDetail(userId);
  }

  @Post(':userId/approve')
  async approve(@Req() req: AuthRequest, @Param('userId') userId: string) {
    const adminId = req.user?.sub;
    return this.creators.adminApprove(userId, adminId);
  }

  @Post(':userId/reject')
  async reject(
    @Req() req: AuthRequest,
    @Param('userId') userId: string,
    @Body() body: { reason?: string }
  ) {
    const adminId = req.user?.sub;
    return this.creators.adminReject(userId, body.reason, adminId);
  }

  @Post(':userId/freeze')
  async freeze(
    @Req() req: AuthRequest,
    @Param('userId') userId: string,
    @Body() body: { 
      reason?: string; 
      mode?: 'permanent' | 'until' | 'days'; 
      until?: string;   // ISO date string
      days?: number;
    }
  ) {
    const adminId = req.user?.sub;
    return this.creators.adminFreeze(userId, body, adminId);
  }

  @Post(':userId/ban')
  async ban(
    @Req() req: AuthRequest,
    @Param('userId') userId: string,
    @Body() body: { reason?: string }
  ) {
    const adminId = req.user?.sub;
    return this.creators.adminBan(userId, body.reason, adminId);
  }

  @Post(':userId/recover')
  async recover(@Req() req: AuthRequest, @Param('userId') userId: string) {
    const adminId = req.user?.sub;
    return this.creators.adminRecover(userId, adminId);
  }

  // ========== 收款账号 Payout 接口 ==========

  /** 获取创作者的收款账号（脱敏） */
  @Get(':userId/payout')
  async getPayout(@Param('userId') userId: string) {
    const payout = await this.prisma.creatorPayout.findUnique({
      where: { userId },
    });

    if (!payout) {
      return null;
    }

    return {
      holderName: payout.holderName || '',
      idCardMasked: maskIdCard(payout.holderIdNumber),
      phoneMasked: maskPhone(payout.reservedPhone),
      cardMasked: maskCard(payout.cardNumber),
      bankName: payout.bankName || '',
      branchName: payout.branchName || '',
      realnameAuthed: payout.realnameAuthed,
      status: payout.status,
      verifiedAt: payout.verifiedAt?.toISOString() || null,
      verifiedBy: payout.verifiedBy || null,
    };
  }

  /** 标记收款账号为已核验 */
  @Post(':userId/payout/verify')
  async verifyPayout(@Req() req: AuthRequest, @Param('userId') userId: string) {
    const adminId = req.user?.sub;
    
    const payout = await this.prisma.creatorPayout.findUnique({
      where: { userId },
    });

    if (!payout) {
      return { ok: false, message: '收款账号不存在' };
    }

    await this.prisma.creatorPayout.update({
      where: { userId },
      data: {
        status: 'verified',
        verifiedAt: new Date(),
        verifiedBy: adminId || null,
      },
    });

    return { ok: true };
  }
}

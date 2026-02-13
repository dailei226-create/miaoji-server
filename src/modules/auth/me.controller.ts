import { Controller, Get, Patch, Put, Body, Param, Query, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from './jwt.guard';
import { Role } from './roles.decorator';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

type AuthRequestUser = {
  sub?: string;
  role?: string;
  openId?: string;
  nickname?: string | null;
};

type AuthRequest = Request & { user?: AuthRequestUser };

const isRole = (value: string | undefined): value is Role => {
  return value === 'buyer' || value === 'creator' || value === 'admin';
};

@Controller()
export class MeController {
  constructor(private auth: AuthService, private prisma: PrismaService) {}

  /** 公开接口：获取用户基本信息（用于作者页） */
  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, nickname: true, bio: true, createdAt: true },
    });
    if (!user) {
      return { id, nickname: '匿名作者', avatar: null, bio: null };
    }
    return {
      id: user.id,
      nickname: user.nickname || '匿名作者',
      avatar: null, // 暂无头像字段
      bio: user.bio || null,
      createdAt: user.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    const payload = req.user;
    const role = isRole(payload?.role) ? payload?.role : undefined;
    return this.auth.getMe(userId, {
      role,
      openId: payload?.openId,
      nickname: payload?.nickname ?? null,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Req() req: AuthRequest, @Body() body: { nickname?: string; bio?: string }) {
    const userId = req.user?.sub as string;
    if (!userId) {
      return { statusCode: 400, message: 'user_not_found' };
    }
    return this.auth.updateProfile(userId, { nickname: body.nickname, bio: body.bio });
  }

  // ========== 站内信 Notice 接口 ==========

  /** 获取当前用户的站内信列表（分页） */
  @UseGuards(JwtAuthGuard)
  @Get('me/notices')
  async listNotices(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = req.user?.sub as string;
    if (!userId) {
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const size = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const skip = (pageNum - 1) * size;

    const [items, total] = await Promise.all([
      this.prisma.notice.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      this.prisma.notice.count({ where: { userId } }),
    ]);

    return {
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        workId: n.workId || null,
        isRead: n.isRead,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      })),
      total,
      page: pageNum,
      pageSize: size,
    };
  }

  /** 获取未读消息数 */
  @UseGuards(JwtAuthGuard)
  @Get('me/notices/unread-count')
  async getUnreadCount(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    if (!userId) {
      return { count: 0 };
    }
    const count = await this.prisma.notice.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  /** 标记消息为已读 */
  @UseGuards(JwtAuthGuard)
  @Patch('me/notices/:id/read')
  async markNoticeRead(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user?.sub as string;
    const noticeId = Number(id);
    if (!userId || isNaN(noticeId)) {
      throw new NotFoundException('notice_not_found');
    }

    const notice = await this.prisma.notice.findUnique({ where: { id: noticeId } });
    if (!notice || notice.userId !== userId) {
      throw new NotFoundException('notice_not_found');
    }

    if (notice.isRead) {
      return { ok: true, id: noticeId, isRead: true, readAt: notice.readAt?.toISOString() };
    }

    const updated = await this.prisma.notice.update({
      where: { id: noticeId },
      data: { isRead: true, readAt: new Date() },
    });

    return {
      ok: true,
      id: updated.id,
      isRead: updated.isRead,
      readAt: updated.readAt?.toISOString(),
    };
  }

  // ========== 收款账号 Payout 接口 ==========

  /** 获取当前用户的收款账号信息 */
  @UseGuards(JwtAuthGuard)
  @Get('me/payout')
  async getPayout(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    if (!userId) {
      return null;
    }

    const payout = await this.prisma.creatorPayout.findUnique({
      where: { userId },
    });

    if (!payout) {
      return null;
    }

    return {
      holderName: payout.holderName || '',
      holderIdNumber: payout.holderIdNumber || '',
      reservedPhone: payout.reservedPhone || '',
      cardNumber: payout.cardNumber || '',
      bankName: payout.bankName || '',
      branchName: payout.branchName || '',
      realnameAuthed: payout.realnameAuthed,
      status: payout.status,
      verifiedAt: payout.verifiedAt?.toISOString() || null,
    };
  }

  /** 保存/更新当前用户的收款账号信息 */
  @UseGuards(JwtAuthGuard)
  @Put('me/payout')
  async savePayout(
    @Req() req: AuthRequest,
    @Body() body: {
      realnameAuthed?: boolean;
      holderName?: string;
      holderIdNumber?: string;
      reservedPhone?: string;
      cardNumber?: string;
      bankName?: string;
      branchName?: string;
    },
  ) {
    const userId = req.user?.sub as string;
    if (!userId) {
      return { ok: false, message: '请先登录' };
    }

    const data = {
      holderName: body.holderName || null,
      holderIdNumber: body.holderIdNumber || null,
      reservedPhone: body.reservedPhone || null,
      cardNumber: body.cardNumber || null,
      bankName: body.bankName || null,
      branchName: body.branchName || null,
      realnameAuthed: !!body.realnameAuthed,
      status: 'submitted', // 用户提交后状态变为 submitted
    };

    await this.prisma.creatorPayout.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return { ok: true };
  }
}

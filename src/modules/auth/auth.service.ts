import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from './roles.decorator';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async mockLogin(payload: { openId: string; nickname?: string; role?: Role }) {
    // 先按 openId 查找用户
    let user = await this.prisma.user.findUnique({
      where: { openId: payload.openId },
    });
    // 如果不存在则自动创建（开发环境）
    if (!user) {
      user = await this.prisma.user.create({
        data: { 
          openId: payload.openId,
          nickname: payload.nickname || null,
        },
      });
    }

    const role: Role = payload.role ?? 'buyer';
    const token = await this.jwt.signAsync({
      sub: user.id,
      role,
      openId: payload.openId,
      nickname: payload.nickname ?? null,
    });

    return {
      token,
      user: {
        id: user.id,
        role,
        nickname: payload.nickname ?? null,
        openId: payload.openId,
      },
    };
  }

  async getMe(userId: string, payload?: { role?: Role; openId?: string; nickname?: string | null }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    // 查询创作者状态及冻结信息
    let creatorStatus = 'none';
    let isCreator = false;
    let freezeReason: string | null = null;
    let frozenUntil: string | null = null;
    try {
      const profiles: any[] = await this.prisma.$queryRawUnsafe(
        'SELECT status, reason, frozenUntil FROM CreatorProfile WHERE userId = ? LIMIT 1',
        userId
      );
      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        let status = profile.status;
        
        // 懒解封检测：如果是 frozen 且到期时间已过
        if (status === 'frozen' && profile.frozenUntil) {
          const untilDate = new Date(profile.frozenUntil);
          if (untilDate <= new Date()) {
            // 到期自动解封
            await this.autoUnfreeze(userId);
            status = 'approved';
            freezeReason = null;
            frozenUntil = null;
          } else {
            freezeReason = profile.reason || null;
            frozenUntil = untilDate.toISOString();
          }
        } else if (status === 'frozen') {
          // 永久冻结
          freezeReason = profile.reason || null;
          frozenUntil = null;
        }
        
        // 统一小写
        creatorStatus = status ? String(status).toLowerCase() : 'none';
        isCreator = creatorStatus === 'approved';
      }
    } catch (e) {
      // 静默失败，保持默认值
    }

    return {
      id: user.id,
      openId: payload?.openId ?? user.id,
      role: payload?.role ?? 'buyer',
      // 优先返回数据库中的 nickname，保证持久化后的值生效
      nickname: (user as any).nickname ?? payload?.nickname ?? null,
      bio: (user as any).bio ?? null,
      createdAt: user.createdAt,
      // 创作者状态
      creatorStatus,
      isCreator,
      // 冻结信息（仅 frozen 时有值）
      freezeReason,
      frozenUntil,
    };
  }

  // 内部方法：自动解封
  private async autoUnfreeze(userId: string) {
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE CreatorProfile SET status = 'approved', unfrozenAt = NOW(), unfrozenBy = 'system', updatedAt = NOW() WHERE userId = ?`,
        userId
      );
      // 发送自动解封通知
      const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      await this.prisma.notice.create({
        data: {
          userId,
          type: 'creator_unfreeze',
          title: '账号已恢复（到期自动解封）',
          content: `您好，\n\n您的创作者账号已到期自动解封，可正常发布作品与接单。\n【解除时间】${now}`,
          isRead: false,
        },
      });
    } catch (e) {
      console.error('[autoUnfreeze error]', e);
    }
  }

  async updateProfile(userId: string, dto: { nickname?: string; bio?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    
    const updateData: any = {};
    if (dto.nickname !== undefined) {
      updateData.nickname = dto.nickname;
    }
    if (dto.bio !== undefined) {
      updateData.bio = dto.bio;
    }
    
    // 如果没有要更新的字段，直接返回当前数据
    if (Object.keys(updateData).length === 0) {
      return {
        id: user.id,
        nickname: (user as any).nickname ?? null,
        bio: (user as any).bio ?? null,
      };
    }
    
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    return {
      id: updated.id,
      nickname: (updated as any).nickname ?? null,
      bio: (updated as any).bio ?? null,
    };
  }
}

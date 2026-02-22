import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from './roles.decorator';
import axios from 'axios';
import { createUniqueUserDisplayNo } from '../../utils/display-no';

@Injectable()
export class AuthService {
  private readonly wxAppId: string;
  private readonly wxAppSecret: string;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.wxAppId = this.config.get<string>('WX_APPID') || this.config.get<string>('WXPAY_APPID') || '';
    this.wxAppSecret = this.config.get<string>('WX_APP_SECRET') || this.config.get<string>('WXPAY_APP_SECRET') || '';
  }

  /**
   * 真实登录：用 wx.login 的 code 换取 openid，然后签发 JWT
   */
  async login(payload: { code: string; nickname?: string }) {
    // 1. 用 code 换 openid
    const openId = await this.getOpenidByCode(payload.code);

    // 2. 查找或创建用户
    let user = await this.prisma.user.findUnique({
      where: { openId },
    });
    if (!user) {
      const displayNo = await createUniqueUserDisplayNo(this.prisma);
      user = await this.prisma.user.create({
        data: {
          displayNo,
          openId,
          nickname: payload.nickname || null,
        },
      });
    } else if (payload.nickname && !(user as any).nickname) {
      // 如果用户存在但没有昵称，且传入了昵称，则更新
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { nickname: payload.nickname },
      });
    }

    // 3. 签发 JWT
    const role: Role = 'buyer'; // 默认角色
    const token = await this.jwt.signAsync({
      sub: user.id,
      role,
      openId,
      nickname: (user as any).nickname ?? payload.nickname ?? null,
    });

    return {
      token,
      user: {
        id: user.id,
        displayNo: (user as any).displayNo ?? null,
        role,
        nickname: (user as any).nickname ?? payload.nickname ?? null,
        openId,
      },
    };
  }

  /**
   * 用 wx.login 的 code 换取 openid
   */
  private async getOpenidByCode(code: string): Promise<string> {
    if (!this.wxAppId || !this.wxAppSecret) {
      throw new BadRequestException(
        '服务端缺少小程序配置：请在 .env 设置 WX_APPID 和 WX_APP_SECRET',
      );
    }

    try {
      const url = 'https://api.weixin.qq.com/sns/jscode2session';
      const { data } = await axios.get(url, {
        params: {
          appid: this.wxAppId,
          secret: this.wxAppSecret,
          js_code: code,
          grant_type: 'authorization_code',
        },
        timeout: 10000,
      });

      if (!data || data.errcode) {
        throw new BadRequestException(
          `code 换 openid 失败：${JSON.stringify(data)}`,
        );
      }

      const openid = data.openid;
      if (!openid) {
        throw new BadRequestException(
          `code 换 openid 失败：未拿到 openid，返回=${JSON.stringify(data)}`,
        );
      }
      return openid;
    } catch (e: any) {
      const detail = e?.response?.data || e?.message || e;
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`code 换 openid 失败：${JSON.stringify(detail)}`);
    }
  }

  async mockLogin(payload: { openId: string; nickname?: string; role?: Role }) {
    // 先按 openId 查找用户
    let user = await this.prisma.user.findUnique({
      where: { openId: payload.openId },
    });
    // 如果不存在则自动创建（开发环境）
    if (!user) {
      const displayNo = await createUniqueUserDisplayNo(this.prisma);
      user = await this.prisma.user.create({
        data: { 
          displayNo,
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
        displayNo: (user as any).displayNo ?? null,
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
      displayNo: (user as any).displayNo ?? null,
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
        `UPDATE CreatorProfile SET status = 'approved', unfrozenAt = UTC_TIMESTAMP(3), unfrozenBy = 'system', updatedAt = UTC_TIMESTAMP(3) WHERE userId = ?`,
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
        displayNo: (user as any).displayNo ?? null,
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
      displayNo: (updated as any).displayNo ?? null,
      nickname: (updated as any).nickname ?? null,
      bio: (updated as any).bio ?? null,
    };
  }
}

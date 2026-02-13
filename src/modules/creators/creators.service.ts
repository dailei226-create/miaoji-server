import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatorStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CreatorsService {
  constructor(private prisma: PrismaService) {}

  private normalizeStatus(status?: string) {
    const raw = typeof status === 'string' ? status.trim() : '';
    if (!raw) return '';
    const allowed = new Set(['pending', 'approved', 'rejected', 'frozen', 'banned']);
    return allowed.has(raw) ? raw : '__invalid__';
  }

  /**
   * 获取创作者状态（供其他模块调用）
   */
  async getCreatorStatus(userId: string): Promise<CreatorStatus | null> {
    try {
      const result: any[] = await this.prisma.$queryRaw(Prisma.sql`
        SELECT status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
      `);
      if (result && result.length > 0) {
        return result[0].status as CreatorStatus;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 检查卖家是否可接单/发货/发布
   */
  async checkSellerCanOperate(userId: string): Promise<{ ok: boolean; message?: string }> {
    const status = await this.getCreatorStatus(userId);
    if (!status) {
      return { ok: false, message: '卖家信息不存在' };
    }
    if (status !== 'approved') {
      const statusTextMap: Record<string, string> = {
        pending: '卖家资质审核中',
        rejected: '卖家资质已被拒绝',
        frozen: '卖家已被冻结',
        banned: '卖家已被封禁',
      };
      return { ok: false, message: statusTextMap[status] || '卖家不可接单' };
    }
    return { ok: true };
  }

  /**
   * 用户端申请成为卖家/创作者
   * 一期 MVP：仅记录 userId 和 status=pending
   * 申请资料（intro, images, isOriginal）暂存前端，后续迭代可添加 applyData 字段
   */
  async userApply(
    userId: string,
    body: { intro?: string; images?: string[]; isOriginal?: boolean; phone?: string; realName?: string; nickname?: string }
  ): Promise<{ ok: boolean; status?: string; message?: string }> {
    if (!userId) {
      return { ok: false, message: '请先登录' };
    }

    // 构建申请资料 JSON（包含全部字段）
    const applyData = JSON.stringify({
      intro: body.intro || '',
      images: body.images || [],
      isOriginal: !!body.isOriginal,
      phone: body.phone || '',
      realName: body.realName || '',
      nickname: body.nickname || '',
      submittedAt: new Date().toISOString(),
    });

    try {
      // 查询是否已有记录
      const existing: any[] = await this.prisma.$queryRaw(Prisma.sql`
        SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
      `);

      if (existing && existing.length > 0) {
        const profile = existing[0];
        const currentStatus = profile.status;

        // 已通过/冻结/封禁：不允许重新申请
        if (['approved', 'frozen', 'banned'].includes(currentStatus)) {
          const msgMap: Record<string, string> = {
            approved: '您已是创作者',
            frozen: '账号已被冻结，无法申请',
            banned: '账号已被封禁，无法申请',
          };
          return { ok: false, message: msgMap[currentStatus] || '当前不可申请' };
        }

        // pending/rejected：允许更新申请资料，重新发起申请
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE CreatorProfile 
          SET status = 'pending', reason = NULL, 
              applyData = ${applyData}, appliedAt = NOW(), 
              phone = ${body.phone || null}, realName = ${body.realName || null},
              updatedAt = NOW()
          WHERE userId = ${userId}
        `);

        // 写操作日志
        await this.writeOpLog(profile.id, 'apply', currentStatus, 'pending', null, null);

        return { ok: true, status: 'pending' };
      }

      // 不存在：创建新记录
      const newId = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO CreatorProfile (id, userId, status, applyData, appliedAt, phone, realName, createdAt, updatedAt)
        VALUES (${newId}, ${userId}, 'pending', ${applyData}, NOW(), ${body.phone || null}, ${body.realName || null}, NOW(), NOW())
      `);

      // 写操作日志
      await this.writeOpLog(newId, 'apply', null, 'pending', null, null);

      return { ok: true, status: 'pending' };
    } catch (e) {
      console.error('[userApply] error:', e);
      return { ok: false, message: '申请失败，请重试' };
    }
  }

  async adminList(status?: string, q?: string) {
    const normalized = this.normalizeStatus(status);
    if (normalized === '__invalid__') return { items: [], total: 0 };

    try {
      let whereClause = '';
      if (normalized) {
        whereClause = `WHERE cp.status = '${normalized}'`;
      }
      if (q) {
        const likeQ = `%${q}%`;
        whereClause = whereClause
          ? `${whereClause} AND (cp.userId LIKE '${likeQ}' OR u.nickname LIKE '${likeQ}')`
          : `WHERE (cp.userId LIKE '${likeQ}' OR u.nickname LIKE '${likeQ}')`;
      }

      const items: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT cp.id, cp.userId, cp.status, cp.phone, cp.realName, cp.reason, 
               cp.applyData, cp.appliedAt, cp.createdAt, cp.updatedAt,
               u.nickname, u.openId
        FROM CreatorProfile AS cp
        LEFT JOIN User AS u ON u.id = cp.userId
        ${whereClause}
        ORDER BY cp.createdAt DESC
      `);

      return { items, total: items.length };
    } catch (e) {
      console.error('[adminList] error:', e);
      return { items: [], total: 0 };
    }
  }

  async adminDetail(userId: string) {
    try {
      const profiles: any[] = await this.prisma.$queryRaw(Prisma.sql`
        SELECT cp.id, cp.userId, cp.status, cp.phone, cp.realName, cp.reason, 
               cp.applyData, cp.appliedAt, cp.createdAt, cp.updatedAt
        FROM CreatorProfile AS cp
        WHERE cp.userId = ${userId}
        LIMIT 1
      `);
      if (!profiles || profiles.length === 0) {
        throw new NotFoundException('创作者不存在');
      }
      const profile = profiles[0];

      // 获取用户信息
      const users: any[] = await this.prisma.$queryRaw(Prisma.sql`
        SELECT id, nickname, openId, createdAt FROM User WHERE id = ${userId} LIMIT 1
      `);
      const user = users && users.length > 0 ? users[0] : null;

      // 获取操作日志
      const opLogs: any[] = await this.prisma.$queryRaw(Prisma.sql`
        SELECT id, action, fromStatus, toStatus, reason, adminId, createdAt
        FROM CreatorOpLog
        WHERE creatorProfileId = ${profile.id}
        ORDER BY createdAt DESC
      `);

      return { ...profile, user, opLogs };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      console.error('[adminDetail] error:', e);
      throw new NotFoundException('创作者不存在');
    }
  }

  private async writeOpLog(
    creatorProfileId: string,
    action: string,
    fromStatus: string | null,
    toStatus: string,
    reason: string | null,
    adminId: string | null
  ) {
    try {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO CreatorOpLog (id, creatorProfileId, action, fromStatus, toStatus, reason, adminId, createdAt)
        VALUES (${`col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}, ${creatorProfileId}, ${action}, ${fromStatus}, ${toStatus}, ${reason}, ${adminId}, NOW())
      `);
    } catch (e) {
      console.error('[writeOpLog] error:', e);
    }
  }

  private async sendNotice(userId: string, type: string, title: string, content: string) {
    try {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO Notice (userId, type, title, content, isRead, createdAt)
        VALUES (${userId}, ${type}, ${title}, ${content}, 0, NOW())
      `);
    } catch (e) {
      console.error('[sendNotice] error:', e);
    }
  }

  async adminApprove(userId: string, adminId?: string) {
    if (!userId) throw new BadRequestException('userId 不能为空');
    
    const profiles: any[] = await this.prisma.$queryRaw(Prisma.sql`
      SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
    if (!profiles || profiles.length === 0) {
      throw new NotFoundException('创作者不存在');
    }
    const profile = profiles[0];
    const fromStatus = profile.status;

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE CreatorProfile SET status = 'approved', reason = NULL, updatedAt = NOW() WHERE userId = ${userId}
    `);
    // 注：User 表无 role 字段，创作者身份通过 CreatorProfile.status=approved 判断

    await this.writeOpLog(profile.id, 'approve', fromStatus, 'approved', null, adminId || null);

    // 发送站内信通知
    await this.sendNotice(userId, 'creator_approve', '创作者审核通过', '恭喜！您的创作者申请已通过审核，可以开始发布作品了。');

    return { ok: true };
  }

  async adminReject(userId: string, reason?: string, adminId?: string) {
    if (!userId) throw new BadRequestException('userId 不能为空');

    const profiles: any[] = await this.prisma.$queryRaw(Prisma.sql`
      SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
    if (!profiles || profiles.length === 0) {
      throw new NotFoundException('创作者不存在');
    }
    const profile = profiles[0];
    const fromStatus = profile.status;

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE CreatorProfile SET status = 'rejected', reason = ${reason || null}, updatedAt = NOW() WHERE userId = ${userId}
    `);

    await this.writeOpLog(profile.id, 'reject', fromStatus, 'rejected', reason || null, adminId || null);

    // 发送站内信通知
    const content = reason 
      ? `您的创作者申请未通过审核。原因：${reason}` 
      : '您的创作者申请未通过审核，请完善资料后重新申请。';
    await this.sendNotice(userId, 'creator_reject', '创作者审核未通过', content);

    return { ok: true };
  }

  async adminFreeze(
    userId: string,
    opts: { reason?: string; mode?: 'permanent' | 'until' | 'days'; until?: string; days?: number },
    adminId?: string
  ) {
    if (!userId) throw new BadRequestException('userId 不能为空');
    const reason = opts.reason;
    if (!reason) throw new BadRequestException('冻结原因不能为空');

    const profiles: any[] = await this.prisma.$queryRaw(Prisma.sql`
      SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
    if (!profiles || profiles.length === 0) {
      throw new NotFoundException('创作者不存在');
    }
    const profile = profiles[0];
    const fromStatus = profile.status;

    // 计算 frozenUntil
    let frozenUntil: Date | null = null;
    const mode = opts.mode || 'permanent';
    if (mode === 'until' && opts.until) {
      frozenUntil = new Date(opts.until);
    } else if (mode === 'days' && opts.days && opts.days > 0) {
      frozenUntil = new Date(Date.now() + opts.days * 24 * 60 * 60 * 1000);
    }
    // permanent => frozenUntil = null

    // 更新状态、原因、冻结时间、到期时间、操作人
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE CreatorProfile 
      SET status = 'frozen', 
          reason = ${reason}, 
          frozenAt = NOW(), 
          frozenUntil = ${frozenUntil}, 
          frozenBy = ${adminId || null},
          unfrozenAt = NULL,
          unfrozenBy = NULL,
          updatedAt = NOW() 
      WHERE userId = ${userId}
    `);

    await this.writeOpLog(profile.id, 'freeze', fromStatus, 'frozen', reason, adminId || null);

    // 发送站内信
    const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const untilStr = frozenUntil 
      ? frozenUntil.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) 
      : '永久';
    const noticeContent = `您好，

由于以下原因，您的创作者账号已被冻结：
【冻结原因】${reason}
【冻结时间】${nowStr}
【解封时间】${untilStr}

冻结期间：
- 无法发布作品
- 无法接收订单
- 无法提现

如需申诉请联系客服。`;
    await this.sendNotice(userId, 'creator_freeze', '账号已被冻结通知', noticeContent);

    return { 
      ok: true, 
      frozenAt: new Date().toISOString(),
      frozenUntil: frozenUntil ? frozenUntil.toISOString() : null,
      reason 
    };
  }

  async adminBan(userId: string, reason?: string, adminId?: string) {
    if (!userId) throw new BadRequestException('userId 不能为空');

    const profiles: any[] = await this.prisma.$queryRaw(Prisma.sql`
      SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
    if (!profiles || profiles.length === 0) {
      throw new NotFoundException('创作者不存在');
    }
    const profile = profiles[0];
    const fromStatus = profile.status;

    // 更新状态、原因、封禁时间
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE CreatorProfile SET status = 'banned', reason = ${reason || null}, frozenAt = NOW(), updatedAt = NOW() WHERE userId = ${userId}
    `);

    await this.writeOpLog(profile.id, 'ban', fromStatus, 'banned', reason || null, adminId || null);

    // 发送站内信
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const noticeContent = `您好，

由于以下原因，您的账号已被封禁：
【原因】${reason || '未说明'}
【时间】${now}

如需申诉请联系客服。`;
    await this.sendNotice(userId, 'creator_ban', '账号已被封禁', noticeContent);

    return { ok: true };
  }

  async adminRecover(userId: string, adminId?: string, isAutoUnfreeze = false) {
    if (!userId) throw new BadRequestException('userId 不能为空');

    const profiles: any[] = await this.prisma.$queryRaw(Prisma.sql`
      SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
    if (!profiles || profiles.length === 0) {
      throw new NotFoundException('创作者不存在');
    }
    const profile = profiles[0];
    const fromStatus = profile.status;

    // 恢复为 approved 状态，记录解冻时间和操作人，保留原因供历史查询
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE CreatorProfile 
      SET status = 'approved', 
          unfrozenAt = NOW(), 
          unfrozenBy = ${adminId || (isAutoUnfreeze ? 'system' : null)},
          updatedAt = NOW() 
      WHERE userId = ${userId}
    `);

    await this.writeOpLog(profile.id, 'recover', fromStatus, 'approved', isAutoUnfreeze ? '到期自动解封' : null, adminId || null);

    // 发送站内信
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const title = isAutoUnfreeze ? '账号已恢复（到期自动解封）' : '账号已解除冻结';
    const noticeContent = `您好，

您的创作者账号已${isAutoUnfreeze ? '到期自动解封' : '解除冻结'}，可正常发布作品与接单。
【解除时间】${now}`;
    await this.sendNotice(userId, 'creator_unfreeze', title, noticeContent);

    return { ok: true };
  }

  // 检查并执行自动解封（懒解封）
  async checkAndAutoUnfreeze(userId: string): Promise<boolean> {
    const profiles: any[] = await this.prisma.$queryRaw(Prisma.sql`
      SELECT id, status, frozenUntil FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
    if (!profiles || profiles.length === 0) return false;
    
    const profile = profiles[0];
    if (profile.status !== 'frozen') return false;
    if (!profile.frozenUntil) return false; // 永久冻结不自动解封
    
    const frozenUntil = new Date(profile.frozenUntil);
    if (frozenUntil > new Date()) return false; // 未到期
    
    // 执行自动解封
    await this.adminRecover(userId, undefined, true);
    return true;
  }
}

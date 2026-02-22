"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatorsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let CreatorsService = class CreatorsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    normalizeStatus(status) {
        const raw = typeof status === 'string' ? status.trim() : '';
        if (!raw)
            return '';
        const allowed = new Set(['pending', 'approved', 'rejected', 'frozen', 'banned']);
        return allowed.has(raw) ? raw : '__invalid__';
    }
    async getCreatorStatus(userId) {
        try {
            const result = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
      `);
            if (result && result.length > 0) {
                return result[0].status;
            }
            return null;
        }
        catch (e) {
            return null;
        }
    }
    async checkSellerCanOperate(userId) {
        const status = await this.getCreatorStatus(userId);
        if (!status) {
            return { ok: false, message: '卖家信息不存在' };
        }
        if (status !== 'approved') {
            const statusTextMap = {
                pending: '卖家资质审核中',
                rejected: '卖家资质已被拒绝',
                frozen: '卖家已被冻结',
                banned: '卖家已被封禁',
            };
            return { ok: false, message: statusTextMap[status] || '卖家不可接单' };
        }
        return { ok: true };
    }
    async userApply(userId, body) {
        if (!userId) {
            return { ok: false, message: '请先登录' };
        }
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
            const now = new Date();
            const existing = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
      `);
            if (existing && existing.length > 0) {
                const profile = existing[0];
                const currentStatus = profile.status;
                if (['approved', 'frozen', 'banned'].includes(currentStatus)) {
                    const msgMap = {
                        approved: '您已是创作者',
                        frozen: '账号已被冻结，无法申请',
                        banned: '账号已被封禁，无法申请',
                    };
                    return { ok: false, message: msgMap[currentStatus] || '当前不可申请' };
                }
                await this.prisma.$executeRaw(client_1.Prisma.sql `
          UPDATE CreatorProfile 
          SET status = 'pending', reason = NULL, 
              applyData = ${applyData}, appliedAt = ${now}, 
              phone = ${body.phone || null}, realName = ${body.realName || null},
              updatedAt = ${now}
          WHERE userId = ${userId}
        `);
                await this.writeOpLog(profile.id, 'apply', currentStatus, 'pending', null, null);
                return { ok: true, status: 'pending' };
            }
            const newId = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await this.prisma.$executeRaw(client_1.Prisma.sql `
        INSERT INTO CreatorProfile (id, userId, status, applyData, appliedAt, phone, realName, createdAt, updatedAt)
        VALUES (${newId}, ${userId}, 'pending', ${applyData}, ${now}, ${body.phone || null}, ${body.realName || null}, ${now}, ${now})
      `);
            await this.writeOpLog(newId, 'apply', null, 'pending', null, null);
            return { ok: true, status: 'pending' };
        }
        catch (e) {
            console.error('[userApply] error:', e);
            return { ok: false, message: '申请失败，请重试' };
        }
    }
    async adminList(status, q) {
        const normalized = this.normalizeStatus(status);
        if (normalized === '__invalid__')
            return { items: [], total: 0 };
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
            const items = await this.prisma.$queryRawUnsafe(`
        SELECT cp.id, cp.userId, cp.status, cp.phone, cp.realName, cp.reason, 
               cp.applyData, cp.appliedAt, cp.createdAt, cp.updatedAt,
               u.nickname, u.openId
        FROM CreatorProfile AS cp
        LEFT JOIN User AS u ON u.id = cp.userId
        ${whereClause}
        ORDER BY cp.createdAt DESC
      `);
            return { items, total: items.length };
        }
        catch (e) {
            console.error('[adminList] error:', e);
            return { items: [], total: 0 };
        }
    }
    async adminDetail(userId) {
        try {
            const profiles = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT cp.id, cp.userId, cp.status, cp.phone, cp.realName, cp.reason, 
               cp.applyData, cp.appliedAt, cp.createdAt, cp.updatedAt
        FROM CreatorProfile AS cp
        WHERE cp.userId = ${userId}
        LIMIT 1
      `);
            if (!profiles || profiles.length === 0) {
                throw new common_1.NotFoundException('创作者不存在');
            }
            const profile = profiles[0];
            const users = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT id, nickname, openId, createdAt FROM User WHERE id = ${userId} LIMIT 1
      `);
            const user = users && users.length > 0 ? users[0] : null;
            const opLogs = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT id, action, fromStatus, toStatus, reason, adminId, createdAt
        FROM CreatorOpLog
        WHERE creatorProfileId = ${profile.id}
        ORDER BY createdAt DESC
      `);
            return { ...profile, user, opLogs };
        }
        catch (e) {
            if (e instanceof common_1.NotFoundException)
                throw e;
            console.error('[adminDetail] error:', e);
            throw new common_1.NotFoundException('创作者不存在');
        }
    }
    async writeOpLog(creatorProfileId, action, fromStatus, toStatus, reason, adminId) {
        try {
            await this.prisma.$executeRaw(client_1.Prisma.sql `
        INSERT INTO CreatorOpLog (id, creatorProfileId, action, fromStatus, toStatus, reason, adminId, createdAt)
        VALUES (${`col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}, ${creatorProfileId}, ${action}, ${fromStatus}, ${toStatus}, ${reason}, ${adminId}, UTC_TIMESTAMP(3))
      `);
        }
        catch (e) {
            console.error('[writeOpLog] error:', e);
        }
    }
    async sendNotice(userId, type, title, content) {
        try {
            await this.prisma.$executeRaw(client_1.Prisma.sql `
        INSERT INTO Notice (userId, type, title, content, isRead, createdAt)
        VALUES (${userId}, ${type}, ${title}, ${content}, 0, UTC_TIMESTAMP(3))
      `);
        }
        catch (e) {
            console.error('[sendNotice] error:', e);
        }
    }
    async adminApprove(userId, adminId) {
        if (!userId)
            throw new common_1.BadRequestException('userId 不能为空');
        const profiles = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
        if (!profiles || profiles.length === 0) {
            throw new common_1.NotFoundException('创作者不存在');
        }
        const profile = profiles[0];
        const fromStatus = profile.status;
        await this.prisma.$executeRaw(client_1.Prisma.sql `
      UPDATE CreatorProfile SET status = 'approved', reason = NULL, updatedAt = UTC_TIMESTAMP(3) WHERE userId = ${userId}
    `);
        await this.writeOpLog(profile.id, 'approve', fromStatus, 'approved', null, adminId || null);
        await this.sendNotice(userId, 'creator_approve', '创作者审核通过', '恭喜！您的创作者申请已通过审核，可以开始发布作品了。');
        return { ok: true };
    }
    async adminReject(userId, reason, adminId) {
        if (!userId)
            throw new common_1.BadRequestException('userId 不能为空');
        const profiles = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
        if (!profiles || profiles.length === 0) {
            throw new common_1.NotFoundException('创作者不存在');
        }
        const profile = profiles[0];
        const fromStatus = profile.status;
        await this.prisma.$executeRaw(client_1.Prisma.sql `
      UPDATE CreatorProfile SET status = 'rejected', reason = ${reason || null}, updatedAt = UTC_TIMESTAMP(3) WHERE userId = ${userId}
    `);
        await this.writeOpLog(profile.id, 'reject', fromStatus, 'rejected', reason || null, adminId || null);
        const content = reason
            ? `您的创作者申请未通过审核。原因：${reason}`
            : '您的创作者申请未通过审核，请完善资料后重新申请。';
        await this.sendNotice(userId, 'creator_reject', '创作者审核未通过', content);
        return { ok: true };
    }
    async adminFreeze(userId, opts, adminId) {
        if (!userId)
            throw new common_1.BadRequestException('userId 不能为空');
        const reason = opts.reason;
        if (!reason)
            throw new common_1.BadRequestException('冻结原因不能为空');
        const profiles = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
        if (!profiles || profiles.length === 0) {
            throw new common_1.NotFoundException('创作者不存在');
        }
        const profile = profiles[0];
        const fromStatus = profile.status;
        let frozenUntil = null;
        const mode = opts.mode || 'permanent';
        if (mode === 'until' && opts.until) {
            frozenUntil = new Date(opts.until);
        }
        else if (mode === 'days' && opts.days && opts.days > 0) {
            frozenUntil = new Date(Date.now() + opts.days * 24 * 60 * 60 * 1000);
        }
        await this.prisma.$executeRaw(client_1.Prisma.sql `
      UPDATE CreatorProfile 
      SET status = 'frozen', 
          reason = ${reason}, 
          frozenAt = UTC_TIMESTAMP(3), 
          frozenUntil = ${frozenUntil}, 
          frozenBy = ${adminId || null},
          unfrozenAt = NULL,
          unfrozenBy = NULL,
          updatedAt = UTC_TIMESTAMP(3) 
      WHERE userId = ${userId}
    `);
        await this.writeOpLog(profile.id, 'freeze', fromStatus, 'frozen', reason, adminId || null);
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
    async adminBan(userId, reason, adminId) {
        if (!userId)
            throw new common_1.BadRequestException('userId 不能为空');
        const profiles = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
        if (!profiles || profiles.length === 0) {
            throw new common_1.NotFoundException('创作者不存在');
        }
        const profile = profiles[0];
        const fromStatus = profile.status;
        await this.prisma.$executeRaw(client_1.Prisma.sql `
      UPDATE CreatorProfile SET status = 'banned', reason = ${reason || null}, frozenAt = UTC_TIMESTAMP(3), updatedAt = UTC_TIMESTAMP(3) WHERE userId = ${userId}
    `);
        await this.writeOpLog(profile.id, 'ban', fromStatus, 'banned', reason || null, adminId || null);
        const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const noticeContent = `您好，

由于以下原因，您的账号已被封禁：
【原因】${reason || '未说明'}
【时间】${now}

如需申诉请联系客服。`;
        await this.sendNotice(userId, 'creator_ban', '账号已被封禁', noticeContent);
        return { ok: true };
    }
    async adminRecover(userId, adminId, isAutoUnfreeze = false) {
        if (!userId)
            throw new common_1.BadRequestException('userId 不能为空');
        const profiles = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, status FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
        if (!profiles || profiles.length === 0) {
            throw new common_1.NotFoundException('创作者不存在');
        }
        const profile = profiles[0];
        const fromStatus = profile.status;
        await this.prisma.$executeRaw(client_1.Prisma.sql `
      UPDATE CreatorProfile 
      SET status = 'approved', 
          unfrozenAt = UTC_TIMESTAMP(3), 
          unfrozenBy = ${adminId || (isAutoUnfreeze ? 'system' : null)},
          updatedAt = UTC_TIMESTAMP(3) 
      WHERE userId = ${userId}
    `);
        await this.writeOpLog(profile.id, 'recover', fromStatus, 'approved', isAutoUnfreeze ? '到期自动解封' : null, adminId || null);
        const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const title = isAutoUnfreeze ? '账号已恢复（到期自动解封）' : '账号已解除冻结';
        const noticeContent = `您好，

您的创作者账号已${isAutoUnfreeze ? '到期自动解封' : '解除冻结'}，可正常发布作品与接单。
【解除时间】${now}`;
        await this.sendNotice(userId, 'creator_unfreeze', title, noticeContent);
        return { ok: true };
    }
    async checkAndAutoUnfreeze(userId) {
        const profiles = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, status, frozenUntil FROM CreatorProfile WHERE userId = ${userId} LIMIT 1
    `);
        if (!profiles || profiles.length === 0)
            return false;
        const profile = profiles[0];
        if (profile.status !== 'frozen')
            return false;
        if (!profile.frozenUntil)
            return false;
        const frozenUntil = new Date(profile.frozenUntil);
        if (frozenUntil > new Date())
            return false;
        await this.adminRecover(userId, undefined, true);
        return true;
    }
};
exports.CreatorsService = CreatorsService;
exports.CreatorsService = CreatorsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CreatorsService);
//# sourceMappingURL=creators.service.js.map
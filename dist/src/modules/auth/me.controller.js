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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("./jwt.guard");
const auth_service_1 = require("./auth.service");
const prisma_service_1 = require("../prisma/prisma.service");
const isRole = (value) => {
    return value === 'buyer' || value === 'creator' || value === 'admin';
};
let MeController = class MeController {
    constructor(auth, prisma) {
        this.auth = auth;
        this.prisma = prisma;
    }
    async getUser(id) {
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
            avatar: null,
            bio: user.bio || null,
            createdAt: user.createdAt,
        };
    }
    async me(req) {
        const userId = req.user?.sub;
        const payload = req.user;
        const role = isRole(payload?.role) ? payload?.role : undefined;
        return this.auth.getMe(userId, {
            role,
            openId: payload?.openId,
            nickname: payload?.nickname ?? null,
        });
    }
    async updateMe(req, body) {
        const userId = req.user?.sub;
        if (!userId) {
            return { statusCode: 400, message: 'user_not_found' };
        }
        return this.auth.updateProfile(userId, { nickname: body.nickname, bio: body.bio });
    }
    async listNotices(req, page, pageSize) {
        const userId = req.user?.sub;
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
    async getUnreadCount(req) {
        const userId = req.user?.sub;
        if (!userId) {
            return { count: 0 };
        }
        const count = await this.prisma.notice.count({
            where: { userId, isRead: false },
        });
        return { count };
    }
    async markNoticeRead(req, id) {
        const userId = req.user?.sub;
        const noticeId = Number(id);
        if (!userId || isNaN(noticeId)) {
            throw new common_1.NotFoundException('notice_not_found');
        }
        const notice = await this.prisma.notice.findUnique({ where: { id: noticeId } });
        if (!notice || notice.userId !== userId) {
            throw new common_1.NotFoundException('notice_not_found');
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
    async getPayout(req) {
        const userId = req.user?.sub;
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
    async savePayout(req, body) {
        const userId = req.user?.sub;
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
            status: 'submitted',
        };
        await this.prisma.creatorPayout.upsert({
            where: { userId },
            create: { userId, ...data },
            update: data,
        });
        return { ok: true };
    }
};
exports.MeController = MeController;
__decorate([
    (0, common_1.Get)('users/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "getUser", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "me", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Patch)('me'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "updateMe", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me/notices'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "listNotices", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me/notices/unread-count'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "getUnreadCount", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Patch)('me/notices/:id/read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "markNoticeRead", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me/payout'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "getPayout", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Put)('me/payout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "savePayout", null);
exports.MeController = MeController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService, prisma_service_1.PrismaService])
], MeController);
//# sourceMappingURL=me.controller.js.map
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
exports.AdminCreatorsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const creators_service_1 = require("./creators.service");
const prisma_service_1 = require("../prisma/prisma.service");
function maskIdCard(id) {
    if (!id || id.length < 10)
        return id || '';
    return id.slice(0, 4) + '**********' + id.slice(-4);
}
function maskPhone(phone) {
    if (!phone || phone.length < 7)
        return phone || '';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
}
function maskCard(card) {
    if (!card || card.length < 8)
        return card || '';
    return card.slice(0, 4) + '********' + card.slice(-4);
}
let AdminCreatorsController = class AdminCreatorsController {
    constructor(creators, prisma) {
        this.creators = creators;
        this.prisma = prisma;
    }
    async list(status, q) {
        return this.creators.adminList(status, q);
    }
    async detail(userId) {
        return this.creators.adminDetail(userId);
    }
    async approve(req, userId) {
        const adminId = req.user?.sub;
        return this.creators.adminApprove(userId, adminId);
    }
    async reject(req, userId, body) {
        const adminId = req.user?.sub;
        return this.creators.adminReject(userId, body.reason, adminId);
    }
    async freeze(req, userId, body) {
        const adminId = req.user?.sub;
        return this.creators.adminFreeze(userId, body, adminId);
    }
    async ban(req, userId, body) {
        const adminId = req.user?.sub;
        return this.creators.adminBan(userId, body.reason, adminId);
    }
    async recover(req, userId) {
        const adminId = req.user?.sub;
        return this.creators.adminRecover(userId, adminId);
    }
    async getPayout(userId) {
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
    async verifyPayout(req, userId) {
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
};
exports.AdminCreatorsController = AdminCreatorsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminCreatorsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminCreatorsController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':userId/approve'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AdminCreatorsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':userId/reject'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminCreatorsController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':userId/freeze'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminCreatorsController.prototype, "freeze", null);
__decorate([
    (0, common_1.Post)(':userId/ban'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminCreatorsController.prototype, "ban", null);
__decorate([
    (0, common_1.Post)(':userId/recover'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AdminCreatorsController.prototype, "recover", null);
__decorate([
    (0, common_1.Get)(':userId/payout'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminCreatorsController.prototype, "getPayout", null);
__decorate([
    (0, common_1.Post)(':userId/payout/verify'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AdminCreatorsController.prototype, "verifyPayout", null);
exports.AdminCreatorsController = AdminCreatorsController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin/creators'),
    __metadata("design:paramtypes", [creators_service_1.CreatorsService, prisma_service_1.PrismaService])
], AdminCreatorsController);
//# sourceMappingURL=creators.admin.controller.js.map
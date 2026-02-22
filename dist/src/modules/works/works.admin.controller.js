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
exports.AdminWorksController = void 0;
const common_1 = require("@nestjs/common");
const works_service_1 = require("./works.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const dto_1 = require("./dto");
let AdminWorksController = class AdminWorksController {
    constructor(works) {
        this.works = works;
    }
    async list(q, page, pageSize, status) {
        return this.works.adminList({ q, status, page: Number(page), pageSize: Number(pageSize) });
    }
    async approve(dto) {
        return this.works.adminApprove(dto.workId);
    }
    async approveById(id) {
        return this.works.adminApprove(id);
    }
    async reject(dto) {
        return this.works.adminReject(dto.workId, dto.reason);
    }
    async rejectById(id, dto) {
        return this.works.adminReject(id, dto.reason);
    }
    async updateWeight(id, dto) {
        return this.works.adminUpdateWeight(id, dto.weight);
    }
    async updateDiscount(id, dto) {
        return this.works.adminUpdateDiscount(id, dto);
    }
    async listOnline(keyword, authorId, categoryId, page, pageSize) {
        return this.works.adminListOnline({
            keyword,
            authorId,
            categoryId,
            page: Number(page) || 1,
            pageSize: Number(pageSize) || 20,
        });
    }
    async setWeight(id, dto) {
        return this.works.adminUpdateWeight(id, dto.weight);
    }
    async offlineWork(id, dto, req) {
        const adminId = req.user?.sub || null;
        return this.works.adminOfflineWork(id, dto.reason, adminId);
    }
    async detail(id) {
        return this.works.adminGet(id);
    }
};
exports.AdminWorksController = AdminWorksController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('approve'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ReviewDecisionDto]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "approveById", null);
__decorate([
    (0, common_1.Post)('reject'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ReviewDecisionDto]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.ReviewDecisionDto]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "rejectById", null);
__decorate([
    (0, common_1.Put)(':id/weight'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateWorkWeightDto]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "updateWeight", null);
__decorate([
    (0, common_1.Put)(':id/discount'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateWorkDiscountDto]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "updateDiscount", null);
__decorate([
    (0, common_1.Get)('online'),
    __param(0, (0, common_1.Query)('keyword')),
    __param(1, (0, common_1.Query)('authorId')),
    __param(2, (0, common_1.Query)('categoryId')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "listOnline", null);
__decorate([
    (0, common_1.Patch)(':id/weight'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateWorkWeightDto]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "setWeight", null);
__decorate([
    (0, common_1.Patch)(':id/offline'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.OfflineWorkDto, Object]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "offlineWork", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminWorksController.prototype, "detail", null);
exports.AdminWorksController = AdminWorksController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin/works'),
    __metadata("design:paramtypes", [works_service_1.WorksService])
], AdminWorksController);
//# sourceMappingURL=works.admin.controller.js.map
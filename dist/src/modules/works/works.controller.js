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
exports.WorksController = void 0;
const common_1 = require("@nestjs/common");
const works_service_1 = require("./works.service");
const dto_1 = require("./dto");
const jwt_guard_1 = require("../auth/jwt.guard");
let WorksController = class WorksController {
    constructor(works) {
        this.works = works;
    }
    async list(q, keyword, categoryId, creatorId, page, pageSize, discount, activityCatId, activitySubId, activityOnly) {
        const query = q || keyword;
        return this.works.listPublic({
            q: query,
            categoryId,
            creatorId: creatorId || undefined,
            page: Number(page),
            pageSize: Number(pageSize),
            discount: discount === '1' ? 1 : undefined,
            activityCatId: activityCatId || undefined,
            activitySubId: activitySubId || undefined,
            activityOnly: activityOnly === '1' ? 1 : undefined,
        });
    }
    async detail(id) {
        return this.works.getPublic(id);
    }
    async myList(req, status) {
        const user = req.user;
        const userId = user?.sub;
        return this.works.listMine({ userId, status, user });
    }
    async myDetail(req, id) {
        const userId = req.user?.sub;
        return this.works.getMine(userId, id);
    }
    async upsertDraft(req, dto) {
        console.log('[PROOF][server recv]', dto.price, dto.priceCent, dto);
        const userId = req.user?.id || req.user?.userId || req.user?.openid || req.user?.sub;
        if (!userId)
            throw new common_1.UnauthorizedException('unauthorized');
        return this.works.upsertDraft(userId, dto);
    }
    async submit(req, id) {
        const userId = req.user?.sub;
        return this.works.submitReview(userId, id);
    }
    async del(req, id) {
        const userId = req.user?.sub;
        return this.works.deleteMine(userId, id);
    }
    async setMyDiscount(req, id, dto) {
        const userId = req.user?.sub;
        return this.works.setDiscountByCreator(id, userId, dto.discountPercent);
    }
    async setMyPrice(req, id, dto) {
        const userId = req.user?.sub;
        return this.works.setPriceByCreator(id, userId, dto.price);
    }
};
exports.WorksController = WorksController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('keyword')),
    __param(2, (0, common_1.Query)('categoryId')),
    __param(3, (0, common_1.Query)('creatorId')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('pageSize')),
    __param(6, (0, common_1.Query)('discount')),
    __param(7, (0, common_1.Query)('activityCatId')),
    __param(8, (0, common_1.Query)('activitySubId')),
    __param(9, (0, common_1.Query)('activityOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], WorksController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorksController.prototype, "detail", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('/me/list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WorksController.prototype, "myList", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('/me/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WorksController.prototype, "myDetail", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)('/me/draft'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.UpsertWorkDto]),
    __metadata("design:returntype", Promise)
], WorksController.prototype, "upsertDraft", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)('/me/:id/submit'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WorksController.prototype, "submit", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Delete)('/me/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WorksController.prototype, "del", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Put)('/me/:id/discount'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dto_1.SetCreatorDiscountDto]),
    __metadata("design:returntype", Promise)
], WorksController.prototype, "setMyDiscount", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Put)('/me/:id/price'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dto_1.SetCreatorPriceDto]),
    __metadata("design:returntype", Promise)
], WorksController.prototype, "setMyPrice", null);
exports.WorksController = WorksController = __decorate([
    (0, common_1.Controller)('works'),
    __metadata("design:paramtypes", [works_service_1.WorksService])
], WorksController);
//# sourceMappingURL=works.controller.js.map
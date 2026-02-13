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
exports.AdminBannersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const banners_service_1 = require("./banners.service");
const dto_1 = require("./dto");
let AdminBannersController = class AdminBannersController {
    constructor(banners) {
        this.banners = banners;
    }
    async list(position) {
        return this.banners.listAdmin(position);
    }
    async create(dto) {
        return this.banners.create(dto);
    }
    async update(id, dto) {
        return this.banners.update(Number(id), dto);
    }
    async setEnabled(id, body) {
        return this.banners.setEnabled(Number(id), body.enabled);
    }
    async updateSort(id, body) {
        return this.banners.updateSort(Number(id), body.sortOrder);
    }
    async remove(id) {
        return this.banners.remove(Number(id));
    }
};
exports.AdminBannersController = AdminBannersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('position')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateBannerDto]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateBannerDto]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/enabled'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "setEnabled", null);
__decorate([
    (0, common_1.Patch)(':id/sort'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "updateSort", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "remove", null);
exports.AdminBannersController = AdminBannersController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin/banners'),
    __metadata("design:paramtypes", [banners_service_1.BannersService])
], AdminBannersController);
//# sourceMappingURL=banners.admin.controller.js.map
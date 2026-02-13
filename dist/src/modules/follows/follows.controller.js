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
exports.FollowsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const dto_1 = require("./dto");
const follows_service_1 = require("./follows.service");
let FollowsController = class FollowsController {
    constructor(follows) {
        this.follows = follows;
    }
    async create(req, dto) {
        const userId = req.user?.sub;
        return this.follows.add(userId, dto.creatorId);
    }
    async list(req) {
        const userId = req.user?.sub;
        return this.follows.list(userId);
    }
    async remove(req, creatorId) {
        const userId = req.user?.sub;
        return this.follows.remove(userId, creatorId);
    }
};
exports.FollowsController = FollowsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CreateFollowDto]),
    __metadata("design:returntype", Promise)
], FollowsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FollowsController.prototype, "list", null);
__decorate([
    (0, common_1.Delete)(':creatorId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('creatorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FollowsController.prototype, "remove", null);
exports.FollowsController = FollowsController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('follows'),
    __metadata("design:paramtypes", [follows_service_1.FollowsService])
], FollowsController);
//# sourceMappingURL=follows.controller.js.map
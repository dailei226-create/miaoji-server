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
exports.CreatorActivityController = exports.ActivitiesController = void 0;
const common_1 = require("@nestjs/common");
const activities_service_1 = require("./activities.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const dto_1 = require("./dto");
let ActivitiesController = class ActivitiesController {
    constructor(activities) {
        this.activities = activities;
    }
    async listPublic() {
        return this.activities.listPublic();
    }
};
exports.ActivitiesController = ActivitiesController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "listPublic", null);
exports.ActivitiesController = ActivitiesController = __decorate([
    (0, common_1.Controller)('activities'),
    __metadata("design:paramtypes", [activities_service_1.ActivitiesService])
], ActivitiesController);
let CreatorActivityController = class CreatorActivityController {
    constructor(activities) {
        this.activities = activities;
    }
    async getCurrent(req) {
        const userId = req.user?.sub || req.user?.id || '';
        return this.activities.getCreatorActivityCurrent(userId);
    }
    async join(req, dto) {
        const userId = req.user?.sub || req.user?.id || '';
        return this.activities.joinActivity(userId, dto);
    }
    async leave(req, dto) {
        const userId = req.user?.sub || req.user?.id || '';
        return this.activities.leaveActivity(userId, dto);
    }
};
exports.CreatorActivityController = CreatorActivityController;
__decorate([
    (0, common_1.Get)('current'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CreatorActivityController.prototype, "getCurrent", null);
__decorate([
    (0, common_1.Post)('join'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.JoinActivityDto]),
    __metadata("design:returntype", Promise)
], CreatorActivityController.prototype, "join", null);
__decorate([
    (0, common_1.Delete)('join'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.LeaveActivityDto]),
    __metadata("design:returntype", Promise)
], CreatorActivityController.prototype, "leave", null);
exports.CreatorActivityController = CreatorActivityController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('creator/activity'),
    __metadata("design:paramtypes", [activities_service_1.ActivitiesService])
], CreatorActivityController);
//# sourceMappingURL=activities.controller.js.map
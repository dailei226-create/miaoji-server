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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const dto_1 = require("./dto");
const jwt_guard_1 = require("./jwt.guard");
const isDev = process.env.NODE_ENV !== 'production';
const isRole = (value) => {
    return value === 'buyer' || value === 'creator' || value === 'admin';
};
let AuthController = class AuthController {
    constructor(auth) {
        this.auth = auth;
    }
    async login(dto) {
        return this.auth.login({ code: dto.code, nickname: dto.nickname });
    }
    async mockLogin(dto) {
        if (!isDev) {
            throw new common_1.ForbiddenException('mock-login is only available in development environment');
        }
        return this.auth.mockLogin({ openId: dto.openId, nickname: dto.nickname, role: dto.role });
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
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('mock-login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.MockLoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "mockLogin", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map
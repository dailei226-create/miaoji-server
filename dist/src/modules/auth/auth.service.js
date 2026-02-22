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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const axios_1 = require("axios");
const display_no_1 = require("../../utils/display-no");
let AuthService = class AuthService {
    constructor(prisma, jwt, config) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.wxAppId = this.config.get('WX_APPID') || this.config.get('WXPAY_APPID') || '';
        this.wxAppSecret = this.config.get('WX_APP_SECRET') || this.config.get('WXPAY_APP_SECRET') || '';
    }
    async login(payload) {
        const openId = await this.getOpenidByCode(payload.code);
        let user = await this.prisma.user.findUnique({
            where: { openId },
        });
        if (!user) {
            const displayNo = await (0, display_no_1.createUniqueUserDisplayNo)(this.prisma);
            user = await this.prisma.user.create({
                data: {
                    displayNo,
                    openId,
                    nickname: payload.nickname || null,
                },
            });
        }
        else if (payload.nickname && !user.nickname) {
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: { nickname: payload.nickname },
            });
        }
        const role = 'buyer';
        const token = await this.jwt.signAsync({
            sub: user.id,
            role,
            openId,
            nickname: user.nickname ?? payload.nickname ?? null,
        });
        return {
            token,
            user: {
                id: user.id,
                displayNo: user.displayNo ?? null,
                role,
                nickname: user.nickname ?? payload.nickname ?? null,
                openId,
            },
        };
    }
    async getOpenidByCode(code) {
        if (!this.wxAppId || !this.wxAppSecret) {
            throw new common_1.BadRequestException('服务端缺少小程序配置：请在 .env 设置 WX_APPID 和 WX_APP_SECRET');
        }
        try {
            const url = 'https://api.weixin.qq.com/sns/jscode2session';
            const { data } = await axios_1.default.get(url, {
                params: {
                    appid: this.wxAppId,
                    secret: this.wxAppSecret,
                    js_code: code,
                    grant_type: 'authorization_code',
                },
                timeout: 10000,
            });
            if (!data || data.errcode) {
                throw new common_1.BadRequestException(`code 换 openid 失败：${JSON.stringify(data)}`);
            }
            const openid = data.openid;
            if (!openid) {
                throw new common_1.BadRequestException(`code 换 openid 失败：未拿到 openid，返回=${JSON.stringify(data)}`);
            }
            return openid;
        }
        catch (e) {
            const detail = e?.response?.data || e?.message || e;
            if (e instanceof common_1.BadRequestException)
                throw e;
            throw new common_1.BadRequestException(`code 换 openid 失败：${JSON.stringify(detail)}`);
        }
    }
    async mockLogin(payload) {
        let user = await this.prisma.user.findUnique({
            where: { openId: payload.openId },
        });
        if (!user) {
            const displayNo = await (0, display_no_1.createUniqueUserDisplayNo)(this.prisma);
            user = await this.prisma.user.create({
                data: {
                    displayNo,
                    openId: payload.openId,
                    nickname: payload.nickname || null,
                },
            });
        }
        const role = payload.role ?? 'buyer';
        const token = await this.jwt.signAsync({
            sub: user.id,
            role,
            openId: payload.openId,
            nickname: payload.nickname ?? null,
        });
        return {
            token,
            user: {
                id: user.id,
                displayNo: user.displayNo ?? null,
                role,
                nickname: payload.nickname ?? null,
                openId: payload.openId,
            },
        };
    }
    async getMe(userId, payload) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return null;
        let creatorStatus = 'none';
        let isCreator = false;
        let freezeReason = null;
        let frozenUntil = null;
        try {
            const profiles = await this.prisma.$queryRawUnsafe('SELECT status, reason, frozenUntil FROM CreatorProfile WHERE userId = ? LIMIT 1', userId);
            if (profiles && profiles.length > 0) {
                const profile = profiles[0];
                let status = profile.status;
                if (status === 'frozen' && profile.frozenUntil) {
                    const untilDate = new Date(profile.frozenUntil);
                    if (untilDate <= new Date()) {
                        await this.autoUnfreeze(userId);
                        status = 'approved';
                        freezeReason = null;
                        frozenUntil = null;
                    }
                    else {
                        freezeReason = profile.reason || null;
                        frozenUntil = untilDate.toISOString();
                    }
                }
                else if (status === 'frozen') {
                    freezeReason = profile.reason || null;
                    frozenUntil = null;
                }
                creatorStatus = status ? String(status).toLowerCase() : 'none';
                isCreator = creatorStatus === 'approved';
            }
        }
        catch (e) {
        }
        return {
            id: user.id,
            displayNo: user.displayNo ?? null,
            openId: payload?.openId ?? user.id,
            role: payload?.role ?? 'buyer',
            nickname: user.nickname ?? payload?.nickname ?? null,
            bio: user.bio ?? null,
            createdAt: user.createdAt,
            creatorStatus,
            isCreator,
            freezeReason,
            frozenUntil,
        };
    }
    async autoUnfreeze(userId) {
        try {
            await this.prisma.$executeRawUnsafe(`UPDATE CreatorProfile SET status = 'approved', unfrozenAt = UTC_TIMESTAMP(3), unfrozenBy = 'system', updatedAt = UTC_TIMESTAMP(3) WHERE userId = ?`, userId);
            const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
            await this.prisma.notice.create({
                data: {
                    userId,
                    type: 'creator_unfreeze',
                    title: '账号已恢复（到期自动解封）',
                    content: `您好，\n\n您的创作者账号已到期自动解封，可正常发布作品与接单。\n【解除时间】${now}`,
                    isRead: false,
                },
            });
        }
        catch (e) {
            console.error('[autoUnfreeze error]', e);
        }
    }
    async updateProfile(userId, dto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return null;
        const updateData = {};
        if (dto.nickname !== undefined) {
            updateData.nickname = dto.nickname;
        }
        if (dto.bio !== undefined) {
            updateData.bio = dto.bio;
        }
        if (Object.keys(updateData).length === 0) {
            return {
                id: user.id,
                displayNo: user.displayNo ?? null,
                nickname: user.nickname ?? null,
                bio: user.bio ?? null,
            };
        }
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
        });
        return {
            id: updated.id,
            displayNo: updated.displayNo ?? null,
            nickname: updated.nickname ?? null,
            bio: updated.bio ?? null,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
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
exports.FollowsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let FollowsService = class FollowsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async add(userId, creatorId) {
        const creator = await this.prisma.user.findUnique({ where: { id: creatorId } });
        if (!creator)
            throw new common_1.NotFoundException('creator_not_found');
        const follow = await this.prisma.follow.upsert({
            where: { userId_creatorId: { userId, creatorId } },
            update: {},
            create: { userId, creatorId },
        });
        return follow;
    }
    async remove(userId, creatorId) {
        await this.prisma.follow.deleteMany({ where: { userId, creatorId } });
        return { ok: true };
    }
    async list(userId) {
        const items = await this.prisma.follow.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { creator: true },
        });
        const creators = items.map((item) => ({
            id: item.creator.id,
            nickname: item.creator.nickname || null,
            createdAt: item.creator.createdAt,
        }));
        return { items: creators };
    }
};
exports.FollowsService = FollowsService;
exports.FollowsService = FollowsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FollowsService);
//# sourceMappingURL=follows.service.js.map
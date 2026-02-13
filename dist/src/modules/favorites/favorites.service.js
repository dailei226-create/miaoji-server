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
exports.FavoritesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let FavoritesService = class FavoritesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    getEffectivePrice(work) {
        const price = typeof work?.price === 'number' ? work.price : 0;
        const discountPrice = typeof work?.discountPrice === 'number' ? work.discountPrice : null;
        const startAt = work?.discountStartAt ? new Date(work.discountStartAt) : null;
        const endAt = work?.discountEndAt ? new Date(work.discountEndAt) : null;
        const now = new Date();
        if (discountPrice == null || !startAt || !endAt) {
            return price;
        }
        if (now >= startAt && now <= endAt) {
            return discountPrice;
        }
        return price;
    }
    getWorkStatus(work) {
        return work.orderItems && work.orderItems.length > 0 ? 'sold_out' : 'on_sale';
    }
    async add(userId, workId) {
        const work = await this.prisma.work.findUnique({ where: { id: workId } });
        if (!work)
            throw new common_1.NotFoundException('work_not_found');
        const favorite = await this.prisma.favorite.upsert({
            where: { userId_workId: { userId, workId } },
            update: { createdAt: new Date() },
            create: { userId, workId },
        });
        return favorite;
    }
    async remove(userId, workId) {
        await this.prisma.favorite.deleteMany({ where: { userId, workId } });
        return { ok: true };
    }
    async list(userId) {
        const items = await this.prisma.favorite.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                work: {
                    include: { orderItems: true },
                },
            },
        });
        const mapped = items.map((fav) => {
            const work = fav.work;
            const status = this.getWorkStatus(work);
            return {
                workId: fav.workId,
                work: {
                    id: work.id,
                    title: work.title,
                    coverUrl: work.coverUrl,
                    cover: work.coverUrl,
                    price: work.price,
                    effectivePrice: this.getEffectivePrice(work),
                    stock: typeof work.stock === 'number' ? work.stock : 0,
                    status,
                },
            };
        });
        return { items: mapped };
    }
};
exports.FavoritesService = FavoritesService;
exports.FavoritesService = FavoritesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FavoritesService);
//# sourceMappingURL=favorites.service.js.map
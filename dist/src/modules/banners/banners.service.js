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
exports.BannersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BannersService = class BannersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    assertTargetValid(targetType, targetId, linkUrl) {
        const t = String(targetType || '').trim();
        const id = (targetId == null) ? '' : String(targetId).trim();
        const url = (linkUrl == null) ? '' : String(linkUrl).trim();
        const needsId = new Set(['CREATOR', 'AUTHOR', 'WORK', 'WORK_DETAIL', 'CATEGORY', 'CATEGORY_L1', 'CATEGORY_L2']);
        if (t === 'H5') {
            if (!url)
                throw new common_1.BadRequestException('linkUrl_required_for_h5');
            if (!/^https?:\/\//i.test(url))
                throw new common_1.BadRequestException('linkUrl_invalid');
            return;
        }
        if (t === 'NONE')
            return;
        if (needsId.has(t)) {
            if (!id)
                throw new common_1.BadRequestException('targetId_required');
            return;
        }
    }
    async listPublic(position) {
        const where = { enabled: true };
        if (position)
            where.position = position;
        const items = await this.prisma.banner.findMany({
            where,
            orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }],
        });
        return items;
    }
    async listAdmin(position) {
        const where = {};
        if (position)
            where.position = position;
        const items = await this.prisma.banner.findMany({
            where,
            orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }],
        });
        return items;
    }
    async create(dto) {
        if (!dto?.imageUrl)
            throw new common_1.BadRequestException('imageUrl_required');
        if (!dto?.position)
            throw new common_1.BadRequestException('position_required');
        if (!dto?.targetType)
            throw new common_1.BadRequestException('targetType_required');
        this.assertTargetValid(dto.targetType, dto.targetId, dto.linkUrl);
        return this.prisma.banner.create({
            data: {
                title: dto.title ?? null,
                imageUrl: dto.imageUrl,
                linkUrl: dto.linkUrl ? String(dto.linkUrl).trim() : null,
                position: dto.position,
                targetType: dto.targetType,
                targetId: dto.targetId ? String(dto.targetId).trim() : null,
                sortOrder: dto.sortOrder ?? 0,
                enabled: dto.enabled ?? true,
            },
        });
    }
    async update(id, dto) {
        const existing = await this.prisma.banner.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('banner_not_found');
        if (dto.imageUrl === '')
            throw new common_1.BadRequestException('imageUrl_required');
        const nextType = dto.targetType !== undefined ? dto.targetType : existing.targetType;
        const nextId = dto.targetId !== undefined
            ? (dto.targetId ? String(dto.targetId).trim() : '')
            : (existing.targetId ? String(existing.targetId).trim() : '');
        const nextUrl = dto.linkUrl !== undefined
            ? (dto.linkUrl ? String(dto.linkUrl).trim() : '')
            : (existing.linkUrl ? String(existing.linkUrl).trim() : '');
        this.assertTargetValid(String(nextType || ''), nextId, nextUrl);
        const data = {};
        if (dto.title !== undefined)
            data.title = dto.title;
        if (dto.imageUrl !== undefined)
            data.imageUrl = dto.imageUrl;
        if (dto.linkUrl !== undefined)
            data.linkUrl = dto.linkUrl ? String(dto.linkUrl).trim() : null;
        if (dto.position !== undefined)
            data.position = dto.position;
        if (dto.targetType !== undefined)
            data.targetType = dto.targetType;
        if (dto.targetId !== undefined)
            data.targetId = dto.targetId ? String(dto.targetId).trim() : null;
        if (dto.sortOrder !== undefined)
            data.sortOrder = dto.sortOrder;
        if (dto.enabled !== undefined)
            data.enabled = dto.enabled;
        return this.prisma.banner.update({ where: { id }, data });
    }
    async setEnabled(id, enabled) {
        const existing = await this.prisma.banner.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('banner_not_found');
        return this.prisma.banner.update({ where: { id }, data: { enabled } });
    }
    async updateSort(id, sortOrder) {
        const existing = await this.prisma.banner.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('banner_not_found');
        return this.prisma.banner.update({ where: { id }, data: { sortOrder } });
    }
    async remove(id) {
        await this.prisma.banner.delete({ where: { id } });
        return { ok: true };
    }
};
exports.BannersService = BannersService;
exports.BannersService = BannersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BannersService);
//# sourceMappingURL=banners.service.js.map
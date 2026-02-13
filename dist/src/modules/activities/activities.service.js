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
exports.ActivitiesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ActivitiesService = class ActivitiesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    isTimeOverlap(aStart, aEnd, bStart, bEnd) {
        const aS = aStart ? aStart.getTime() : -Infinity;
        const aE = aEnd ? aEnd.getTime() : Infinity;
        const bS = bStart ? bStart.getTime() : -Infinity;
        const bE = bEnd ? bEnd.getTime() : Infinity;
        return aS < bE && bS < aE;
    }
    hasCategoryIntersection(a, b) {
        if (a.length === 0 || b.length === 0) {
            return true;
        }
        const setB = new Set(b);
        return a.some((id) => setB.has(id));
    }
    async disableConflictingActivities(excludeId, startAt, endAt, categoryIds) {
        const enabledActivities = await this.prisma.activity.findMany({
            where: {
                enabled: true,
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
        });
        const conflictIds = [];
        for (const act of enabledActivities) {
            const actCatIds = Array.isArray(act.categoryIds) ? act.categoryIds : [];
            if (!this.isTimeOverlap(startAt, endAt, act.startAt, act.endAt)) {
                continue;
            }
            if (!this.hasCategoryIntersection(categoryIds, actCatIds)) {
                continue;
            }
            conflictIds.push(act.id);
        }
        if (conflictIds.length > 0) {
            await this.prisma.activity.updateMany({
                where: { id: { in: conflictIds } },
                data: { enabled: false },
            });
        }
    }
    async listPublic() {
        const now = new Date();
        const items = await this.prisma.activity.findMany({
            where: {
                enabled: true,
                AND: [
                    { OR: [{ startAt: null }, { startAt: { lte: now } }] },
                    { OR: [{ endAt: null }, { endAt: { gte: now } }] },
                ],
            },
            orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
        });
        return items;
    }
    async listAdmin() {
        const items = await this.prisma.activity.findMany({
            orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
        });
        return items;
    }
    async create(dto) {
        if (!dto?.imageUrl)
            throw new common_1.BadRequestException('imageUrl_required');
        if (!dto?.title)
            throw new common_1.BadRequestException('title_required');
        const discountMin = dto.discountMin ?? 70;
        const discountMax = dto.discountMax ?? 95;
        if (discountMin < 1 || discountMin > 100 || discountMax < 1 || discountMax > 100) {
            throw new common_1.BadRequestException('折扣区间须在 1~100 之间');
        }
        if (discountMin > discountMax) {
            throw new common_1.BadRequestException('折扣下限不能大于上限');
        }
        const enabled = dto.enabled ?? true;
        const startAt = dto.startAt ? new Date(dto.startAt) : null;
        const endAt = dto.endAt ? new Date(dto.endAt) : null;
        const categoryIdsList = Array.isArray(dto.categoryIds) ? dto.categoryIds : [];
        if (enabled)
            await this.disableConflictingActivities(undefined, startAt, endAt, categoryIdsList);
        return this.prisma.activity.create({
            data: {
                title: dto.title,
                imageUrl: dto.imageUrl,
                linkUrl: dto.linkUrl ?? null,
                linkType: dto.linkType ?? null,
                appId: dto.appId ?? null,
                path: dto.path ?? null,
                enabled,
                weight: typeof dto.weight === 'number' ? dto.weight : 0,
                startAt: dto.startAt ? new Date(dto.startAt) : null,
                endAt: dto.endAt ? new Date(dto.endAt) : null,
                discountMin,
                discountMax,
                durationDays: dto.durationDays ?? null,
                ...(Array.isArray(dto.categoryIds) && { categoryIds: dto.categoryIds }),
            },
        });
    }
    async update(id, dto) {
        const existing = await this.prisma.activity.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('activity_not_found');
        if (dto.imageUrl === '')
            throw new common_1.BadRequestException('imageUrl_required');
        if (dto.title === '')
            throw new common_1.BadRequestException('title_required');
        const discountMin = dto.discountMin ?? existing.discountMin;
        const discountMax = dto.discountMax ?? existing.discountMax;
        if (discountMin < 1 || discountMin > 100 || discountMax < 1 || discountMax > 100) {
            throw new common_1.BadRequestException('折扣区间须在 1~100 之间');
        }
        if (discountMin > discountMax) {
            throw new common_1.BadRequestException('折扣下限不能大于上限');
        }
        const willEnable = dto.enabled === undefined ? existing.enabled : dto.enabled;
        if (willEnable) {
            const newStartAt = dto.startAt !== undefined ? (dto.startAt ? new Date(dto.startAt) : null) : existing.startAt;
            const newEndAt = dto.endAt !== undefined ? (dto.endAt ? new Date(dto.endAt) : null) : existing.endAt;
            const newCategoryIds = dto.categoryIds !== undefined
                ? (Array.isArray(dto.categoryIds) ? dto.categoryIds : [])
                : (Array.isArray(existing.categoryIds) ? existing.categoryIds : []);
            await this.disableConflictingActivities(id, newStartAt, newEndAt, newCategoryIds);
        }
        const data = {};
        if (dto.title !== undefined)
            data.title = dto.title;
        if (dto.imageUrl !== undefined)
            data.imageUrl = dto.imageUrl;
        if (dto.linkUrl !== undefined)
            data.linkUrl = dto.linkUrl;
        if (dto.linkType !== undefined)
            data.linkType = dto.linkType;
        if (dto.appId !== undefined)
            data.appId = dto.appId;
        if (dto.path !== undefined)
            data.path = dto.path;
        if (dto.enabled !== undefined)
            data.enabled = dto.enabled;
        if (dto.weight !== undefined)
            data.weight = dto.weight;
        if (dto.startAt !== undefined)
            data.startAt = dto.startAt ? new Date(dto.startAt) : null;
        if (dto.endAt !== undefined)
            data.endAt = dto.endAt ? new Date(dto.endAt) : null;
        if (dto.discountMin !== undefined)
            data.discountMin = dto.discountMin;
        if (dto.discountMax !== undefined)
            data.discountMax = dto.discountMax;
        if (dto.durationDays !== undefined)
            data.durationDays = dto.durationDays;
        if (dto.categoryIds !== undefined)
            data.categoryIds = Array.isArray(dto.categoryIds) ? dto.categoryIds : undefined;
        return this.prisma.activity.update({
            where: { id },
            data,
        });
    }
    async remove(id) {
        await this.prisma.activity.delete({ where: { id } });
        return { ok: true };
    }
    async getCurrentActivities() {
        const now = new Date();
        const activities = await this.prisma.activity.findMany({
            where: {
                enabled: true,
                AND: [
                    { OR: [{ startAt: null }, { startAt: { lte: now } }] },
                    { OR: [{ endAt: null }, { endAt: { gte: now } }] },
                ],
            },
            orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
        });
        return activities;
    }
    async getCurrentActivity() {
        const activities = await this.getCurrentActivities();
        return activities.length > 0 ? activities[0] : null;
    }
    buildCategoryActivityMap(activities) {
        const map = {};
        for (const act of activities) {
            const catIds = Array.isArray(act.categoryIds) ? act.categoryIds : [];
            if (catIds.length === 0) {
                if (!map['__any__'])
                    map['__any__'] = act;
            }
            else {
                for (const catId of catIds) {
                    if (!map[catId]) {
                        map[catId] = act;
                    }
                }
            }
        }
        return map;
    }
    async getCreatorActivityCurrent(creatorId) {
        const activities = await this.getCurrentActivities();
        if (activities.length === 0) {
            return { activities: [], activityByCategoryId: {}, joinedWorks: [], availableWorks: [] };
        }
        const catActivityMap = this.buildCategoryActivityMap(activities);
        const activityIds = activities.map((a) => a.id);
        const joins = await this.prisma.activityJoin.findMany({
            where: { activityId: { in: activityIds }, leftAt: null },
            orderBy: { createdAt: 'desc' },
        });
        const joinByWorkId = new Map();
        const activityById = new Map(activities.map((a) => [a.id, a]));
        for (const j of joins) {
            if (!joinByWorkId.has(j.workId)) {
                joinByWorkId.set(j.workId, { ...j, activity: activityById.get(j.activityId) });
            }
        }
        const leftJoins = await this.prisma.activityJoin.findMany({
            where: { activityId: { in: activityIds }, leftAt: { not: null } },
            select: { workId: true },
        });
        const leftWorkIds = new Set(leftJoins.map((j) => j.workId));
        const allWorks = await this.prisma.work.findMany({
            where: { creatorId, status: 'online' },
            orderBy: { updatedAt: 'desc' },
        });
        const joinedWorks = [];
        const availableWorks = [];
        for (const work of allWorks) {
            const joinRecord = joinByWorkId.get(work.id);
            const workData = {
                id: work.id,
                title: work.title,
                price: work.price,
                coverUrl: work.coverUrl,
                categoryId: work.categoryId,
                subCategoryId: work.subCategoryId,
                createdAt: work.createdAt,
                updatedAt: work.updatedAt,
            };
            if (joinRecord) {
                joinedWorks.push({
                    ...workData,
                    discount: joinRecord.discount,
                    joinedAt: joinRecord.createdAt,
                    activityPrice: Math.round((work.price * joinRecord.discount) / 100),
                    activityId: joinRecord.activityId,
                    activityTitle: joinRecord.activity?.title || '',
                });
            }
            else if (!leftWorkIds.has(work.id)) {
                const catKey = work.categoryId ?? '__any__';
                const matchedActivity = catActivityMap[catKey] || catActivityMap['__any__'];
                if (matchedActivity) {
                    availableWorks.push({
                        ...workData,
                        activityId: matchedActivity.id,
                        activityTitle: matchedActivity.title || '',
                        discountMin: matchedActivity.discountMin,
                        discountMax: matchedActivity.discountMax,
                    });
                }
            }
        }
        const activityByCategoryId = {};
        for (const [catId, act] of Object.entries(catActivityMap)) {
            activityByCategoryId[catId] = {
                id: act.id,
                title: act.title,
                discountMin: act.discountMin,
                discountMax: act.discountMax,
                categoryIds: Array.isArray(act.categoryIds) ? act.categoryIds : [],
                startAt: act.startAt,
                endAt: act.endAt,
            };
        }
        return {
            activities: activities.map((a) => ({
                id: a.id,
                title: a.title,
                discountMin: a.discountMin,
                discountMax: a.discountMax,
                categoryIds: Array.isArray(a.categoryIds) ? a.categoryIds : [],
                startAt: a.startAt,
                endAt: a.endAt,
                durationDays: a.durationDays,
            })),
            activityByCategoryId,
            joinedWorks,
            availableWorks,
        };
    }
    async joinActivity(creatorId, dto) {
        const work = await this.prisma.work.findUnique({ where: { id: dto.workId } });
        if (!work) {
            throw new common_1.NotFoundException('作品不存在');
        }
        if (work.creatorId !== creatorId) {
            throw new common_1.BadRequestException('只能让自己的作品参加活动');
        }
        if (work.status !== 'online') {
            throw new common_1.BadRequestException('只能让上架中的作品参加活动');
        }
        const activities = await this.getCurrentActivities();
        if (activities.length === 0) {
            throw new common_1.BadRequestException('当前没有生效的活动');
        }
        const catActivityMap = this.buildCategoryActivityMap(activities);
        const catKey = work.categoryId ?? '__any__';
        const matchedActivity = catActivityMap[catKey] || catActivityMap['__any__'];
        if (!matchedActivity) {
            throw new common_1.BadRequestException('作品类目不在任何活动可参加范围内');
        }
        if (dto.discount < matchedActivity.discountMin || dto.discount > matchedActivity.discountMax) {
            throw new common_1.BadRequestException(`折扣须在 ${matchedActivity.discountMin}～${matchedActivity.discountMax} 之间`);
        }
        const existing = await this.prisma.activityJoin.findUnique({
            where: { activityId_workId: { activityId: matchedActivity.id, workId: dto.workId } },
        });
        if (existing) {
            if (existing.leftAt) {
                throw new common_1.BadRequestException('本期已退出，不可再次参加');
            }
            return {
                ok: true,
                joinId: existing.id,
                activityId: matchedActivity.id,
                workId: dto.workId,
                discount: existing.discount,
                alreadyJoined: true,
            };
        }
        const allActivityIds = activities.map((a) => a.id);
        const creatorWorks = await this.prisma.work.findMany({
            where: { creatorId, status: 'online' },
            select: { id: true },
        });
        const creatorWorkIds = creatorWorks.map((w) => w.id);
        const activeJoinsCount = await this.prisma.activityJoin.count({
            where: {
                activityId: { in: allActivityIds },
                workId: { in: creatorWorkIds },
                leftAt: null,
            },
        });
        if (activeJoinsCount >= 5) {
            throw new common_1.BadRequestException('每人最多同时参加 5 个作品，请先退出部分作品');
        }
        const join = await this.prisma.activityJoin.create({
            data: {
                activityId: matchedActivity.id,
                workId: dto.workId,
                discount: dto.discount,
            },
        });
        return {
            ok: true,
            joinId: join.id,
            activityId: matchedActivity.id,
            workId: dto.workId,
            discount: dto.discount,
            alreadyJoined: false,
        };
    }
    async leaveActivity(creatorId, dto) {
        const work = await this.prisma.work.findUnique({ where: { id: dto.workId } });
        if (!work) {
            throw new common_1.NotFoundException('作品不存在');
        }
        if (work.creatorId !== creatorId) {
            throw new common_1.BadRequestException('只能操作自己的作品');
        }
        const activities = await this.getCurrentActivities();
        const activityIds = activities.map((a) => a.id);
        await this.prisma.activityJoin.updateMany({
            where: { activityId: { in: activityIds }, workId: dto.workId, leftAt: null },
            data: { leftAt: new Date() },
        });
        return { ok: true };
    }
    async getActiveJoinByWorkId(workId) {
        const activities = await this.getCurrentActivities();
        if (activities.length === 0)
            return null;
        const activityIds = activities.map((a) => a.id);
        const activityById = new Map(activities.map((a) => [a.id, a]));
        const join = await this.prisma.activityJoin.findFirst({
            where: { activityId: { in: activityIds }, workId, leftAt: null },
        });
        if (!join)
            return null;
        const activity = activityById.get(join.activityId);
        return {
            activityId: join.activityId,
            discount: join.discount,
            startAt: activity?.startAt || null,
            endAt: activity?.endAt || null,
        };
    }
};
exports.ActivitiesService = ActivitiesService;
exports.ActivitiesService = ActivitiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ActivitiesService);
//# sourceMappingURL=activities.service.js.map
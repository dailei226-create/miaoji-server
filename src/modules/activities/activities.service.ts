// FREEZE(activity): only BUGFIX/STYLE. DO NOT change data shape / core logic.
// Any modification must include [BUGFIX] or [STYLE] in commit message.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto, UpdateActivityDto, JoinActivityDto, LeaveActivityDto } from './dto';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  /** 判断两个时间段是否重叠 */
  private isTimeOverlap(
    aStart: Date | null, aEnd: Date | null,
    bStart: Date | null, bEnd: Date | null,
  ): boolean {
    // null 表示无限制，视为无穷
    const aS = aStart ? aStart.getTime() : -Infinity;
    const aE = aEnd ? aEnd.getTime() : Infinity;
    const bS = bStart ? bStart.getTime() : -Infinity;
    const bE = bEnd ? bEnd.getTime() : Infinity;
    // 重叠: A.start < B.end && B.start < A.end
    return aS < bE && bS < aE;
  }

  /** 判断两个类目数组是否有交集 */
  private hasCategoryIntersection(a: string[], b: string[]): boolean {
    if (a.length === 0 || b.length === 0) {
      // 空数组表示不限类目，与任何类目冲突
      return true;
    }
    const setB = new Set(b);
    return a.some((id) => setB.has(id));
  }

  /** 自动禁用冲突活动（时间重叠 + 类目交集） */
  private async disableConflictingActivities(
    excludeId: string | undefined,
    startAt: Date | null,
    endAt: Date | null,
    categoryIds: string[],
  ): Promise<void> {
    // 获取所有 enabled=true 且非当前活动
    const enabledActivities = await this.prisma.activity.findMany({
      where: {
        enabled: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    const conflictIds: string[] = [];
    for (const act of enabledActivities) {
      const actCatIds: string[] = Array.isArray(act.categoryIds) ? (act.categoryIds as string[]) : [];
      // 检查时间重叠
      if (!this.isTimeOverlap(startAt, endAt, act.startAt, act.endAt)) {
        continue; // 时间不重叠，无冲突
      }
      // 检查类目交集
      if (!this.hasCategoryIntersection(categoryIds, actCatIds)) {
        continue; // 类目无交集，无冲突
      }
      // 有冲突
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

  async create(dto: CreateActivityDto) {
    if (!dto?.imageUrl) throw new BadRequestException('imageUrl_required');
    if (!dto?.title) throw new BadRequestException('title_required');
    // 校验 discountMin <= discountMax
    const discountMin = dto.discountMin ?? 70;
    const discountMax = dto.discountMax ?? 95;
    if (discountMin < 1 || discountMin > 100 || discountMax < 1 || discountMax > 100) {
      throw new BadRequestException('折扣区间须在 1~100 之间');
    }
    if (discountMin > discountMax) {
      throw new BadRequestException('折扣下限不能大于上限');
    }
    const enabled = dto.enabled ?? true;
    const startAt = dto.startAt ? new Date(dto.startAt) : null;
    const endAt = dto.endAt ? new Date(dto.endAt) : null;
    const categoryIdsList: string[] = Array.isArray(dto.categoryIds) ? dto.categoryIds : [];
    // 启用时自动禁用冲突活动（时间重叠+类目交集）
    if (enabled) await this.disableConflictingActivities(undefined, startAt, endAt, categoryIdsList);
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

  async update(id: string, dto: UpdateActivityDto) {
    const existing = await this.prisma.activity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('activity_not_found');
    if (dto.imageUrl === '') throw new BadRequestException('imageUrl_required');
    if (dto.title === '') throw new BadRequestException('title_required');
    // 校验 discountMin <= discountMax
    const discountMin = dto.discountMin ?? existing.discountMin;
    const discountMax = dto.discountMax ?? existing.discountMax;
    if (discountMin < 1 || discountMin > 100 || discountMax < 1 || discountMax > 100) {
      throw new BadRequestException('折扣区间须在 1~100 之间');
    }
    if (discountMin > discountMax) {
      throw new BadRequestException('折扣下限不能大于上限');
    }
    const willEnable = dto.enabled === undefined ? existing.enabled : dto.enabled;
    // 启用时自动禁用冲突活动（时间重叠+类目交集）
    if (willEnable) {
      const newStartAt = dto.startAt !== undefined ? (dto.startAt ? new Date(dto.startAt) : null) : existing.startAt;
      const newEndAt = dto.endAt !== undefined ? (dto.endAt ? new Date(dto.endAt) : null) : existing.endAt;
      const newCategoryIds: string[] = dto.categoryIds !== undefined 
        ? (Array.isArray(dto.categoryIds) ? dto.categoryIds : [])
        : (Array.isArray(existing.categoryIds) ? (existing.categoryIds as string[]) : []);
      await this.disableConflictingActivities(id, newStartAt, newEndAt, newCategoryIds);
    }
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.linkUrl !== undefined) data.linkUrl = dto.linkUrl;
    if (dto.linkType !== undefined) data.linkType = dto.linkType;
    if (dto.appId !== undefined) data.appId = dto.appId;
    if (dto.path !== undefined) data.path = dto.path;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.weight !== undefined) data.weight = dto.weight;
    if (dto.startAt !== undefined) data.startAt = dto.startAt ? new Date(dto.startAt) : null;
    if (dto.endAt !== undefined) data.endAt = dto.endAt ? new Date(dto.endAt) : null;
    if (dto.discountMin !== undefined) data.discountMin = dto.discountMin;
    if (dto.discountMax !== undefined) data.discountMax = dto.discountMax;
    if (dto.durationDays !== undefined) data.durationDays = dto.durationDays;
    if (dto.categoryIds !== undefined) data.categoryIds = Array.isArray(dto.categoryIds) ? dto.categoryIds : undefined;
    return this.prisma.activity.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.prisma.activity.delete({ where: { id } });
    return { ok: true };
  }

  // ==================== Creator 侧活动参加接口 ====================

  /** 获取当前生效的所有活动（enabled=true 且在有效期内），按 weight desc 排序 */
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

  /** 获取当前生效的活动（兼容旧调用，返回第一个） */
  async getCurrentActivity() {
    const activities = await this.getCurrentActivities();
    return activities.length > 0 ? activities[0] : null;
  }

  /** 构建 categoryId -> Activity 映射（每个类目取权重最高的活动） */
  buildCategoryActivityMap(activities: any[]): Record<string, any> {
    const map: Record<string, any> = {};
    // 活动已按 weight desc 排序，先遇到的优先
    for (const act of activities) {
      const catIds: string[] = Array.isArray(act.categoryIds) ? (act.categoryIds as string[]) : [];
      if (catIds.length === 0) {
        // 空类目表示不限，需要特殊标记
        if (!map['__any__']) map['__any__'] = act;
      } else {
        for (const catId of catIds) {
          if (!map[catId]) {
            map[catId] = act;
          }
        }
      }
    }
    return map;
  }

  /** creator 获取当前活动列表 + 已参加作品 + 可参加作品 */
  async getCreatorActivityCurrent(creatorId: string) {
    const activities = await this.getCurrentActivities();
    if (activities.length === 0) {
      return { activities: [], activityByCategoryId: {}, joinedWorks: [], availableWorks: [] };
    }

    // 构建 categoryId -> activity 映射
    const catActivityMap = this.buildCategoryActivityMap(activities);

    // 所有活动 ID
    const activityIds = activities.map((a) => a.id);

    // 获取所有这些活动的参加记录（只查未退出的）
    const joins = await this.prisma.activityJoin.findMany({
      where: { activityId: { in: activityIds }, leftAt: null },
      orderBy: { createdAt: 'desc' },
    });
    // workId -> join 记录（可能参加了多个活动，但通常是一个）
    const joinByWorkId = new Map<string, any>();
    const activityById = new Map(activities.map((a) => [a.id, a]));
    for (const j of joins) {
      if (!joinByWorkId.has(j.workId)) {
        joinByWorkId.set(j.workId, { ...j, activity: activityById.get(j.activityId) });
      }
    }

    // 获取所有已退出的 workId（本期不可再参加）
    const leftJoins = await this.prisma.activityJoin.findMany({
      where: { activityId: { in: activityIds }, leftAt: { not: null } },
      select: { workId: true },
    });
    const leftWorkIds = new Set(leftJoins.map((j) => j.workId));

    // 获取该创作者所有上架作品
    const allWorks = await this.prisma.work.findMany({
      where: { creatorId, status: 'online' },
      orderBy: { updatedAt: 'desc' },
    });

    const joinedWorks: any[] = [];
    const availableWorks: any[] = [];

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
        // 已参加某个活动
        joinedWorks.push({
          ...workData,
          discount: joinRecord.discount,
          joinedAt: joinRecord.createdAt,
          activityPrice: Math.round((work.price * joinRecord.discount) / 100),
          activityId: joinRecord.activityId,
          activityTitle: joinRecord.activity?.title || '',
        });
      } else if (!leftWorkIds.has(work.id)) {
        // 检查是否有匹配活动（按作品一级类目）；已退出的不再列入可参加
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

    // 构建 activityByCategoryId（序列化给前端使用）
    const activityByCategoryId: Record<string, any> = {};
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

  /** creator 参加活动 */
  async joinActivity(creatorId: string, dto: JoinActivityDto) {
    // 校验作品归属
    const work = await this.prisma.work.findUnique({ where: { id: dto.workId } });
    if (!work) {
      throw new NotFoundException('作品不存在');
    }
    if (work.creatorId !== creatorId) {
      throw new BadRequestException('只能让自己的作品参加活动');
    }
    if (work.status !== 'online') {
      throw new BadRequestException('只能让上架中的作品参加活动');
    }

    // 获取所有当前活动，根据作品类目匹配
    const activities = await this.getCurrentActivities();
    if (activities.length === 0) {
      throw new BadRequestException('当前没有生效的活动');
    }

    const catActivityMap = this.buildCategoryActivityMap(activities);
    const catKey = work.categoryId ?? '__any__';
    const matchedActivity = catActivityMap[catKey] || catActivityMap['__any__'];
    if (!matchedActivity) {
      throw new BadRequestException('作品类目不在任何活动可参加范围内');
    }

    // 校验折扣范围
    if (dto.discount < matchedActivity.discountMin || dto.discount > matchedActivity.discountMax) {
      throw new BadRequestException(`折扣须在 ${matchedActivity.discountMin}～${matchedActivity.discountMax} 之间`);
    }

    // 检查是否已存在该活动记录
    const existing = await this.prisma.activityJoin.findUnique({
      where: { activityId_workId: { activityId: matchedActivity.id, workId: dto.workId } },
    });
    if (existing) {
      // 若已退出（leftAt 不为 null），拒绝再次参加
      if (existing.leftAt) {
        throw new BadRequestException('本期已退出，不可再次参加');
      }
      // 幂等返回，不抛异常
      return {
        ok: true,
        joinId: existing.id,
        activityId: matchedActivity.id,
        workId: dto.workId,
        discount: existing.discount,
        alreadyJoined: true,
      };
    }

    // 检查该创作者当前参加作品数量限制（最多 5 个）
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
        leftAt: null, // 未退出的
      },
    });
    if (activeJoinsCount >= 5) {
      throw new BadRequestException('每人最多同时参加 5 个作品，请先退出部分作品');
    }

    // 创建参加记录
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

  /** creator 退出活动（软删除：设置 leftAt，不可再参加同一活动） */
  async leaveActivity(creatorId: string, dto: LeaveActivityDto) {
    // 校验作品归属
    const work = await this.prisma.work.findUnique({ where: { id: dto.workId } });
    if (!work) {
      throw new NotFoundException('作品不存在');
    }
    if (work.creatorId !== creatorId) {
      throw new BadRequestException('只能操作自己的作品');
    }

    // 获取当前所有活动 ID
    const activities = await this.getCurrentActivities();
    const activityIds = activities.map((a) => a.id);

    // 软删除：设置 leftAt，不再删除记录
    await this.prisma.activityJoin.updateMany({
      where: { activityId: { in: activityIds }, workId: dto.workId, leftAt: null },
      data: { leftAt: new Date() },
    });

    return { ok: true };
  }

  /** 根据 workId 获取活动参加记录（用于价格计算，支持多活动） */
  async getActiveJoinByWorkId(workId: string) {
    const activities = await this.getCurrentActivities();
    if (activities.length === 0) return null;

    const activityIds = activities.map((a) => a.id);
    const activityById = new Map(activities.map((a) => [a.id, a]));

    // 查找该作品在任一活动的参加记录（只查未退出的）
    const join = await this.prisma.activityJoin.findFirst({
      where: { activityId: { in: activityIds }, workId, leftAt: null },
    });
    if (!join) return null;

    const activity = activityById.get(join.activityId);
    return {
      activityId: join.activityId,
      discount: join.discount,
      startAt: activity?.startAt || null,
      endAt: activity?.endAt || null,
    };
  }
}

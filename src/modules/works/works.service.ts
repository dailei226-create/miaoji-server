// FREEZE(activity): effectivePrice / buildActivityJoinMap logic locked. Only BUGFIX/STYLE allowed.
// Any modification to price calculation must include [BUGFIX] in commit message.

import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertWorkDto } from './dto';

let adminListDiagnosticsPrinted = false;

@Injectable()
export class WorksService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private getWorkStatus(work: { status?: string | null }) {
    const raw = String(work?.status || '').toLowerCase();
    if (raw === 'online') return 'on_sale';
    if (raw === 'on_sale') return 'on_sale';
    if (raw === 'reviewing') return 'reviewing';
    if (raw === 'draft') return 'draft';
    if (raw === 'rejected') return 'offline';
    if (raw === 'offline') return 'offline';
    if (raw === 'sold_out') return 'sold_out';
    return raw || 'draft';
  }

  private normalizeStatusFilter(rawStatus: string) {
    const normalized = String(rawStatus || '').trim().toLowerCase();
    if (!normalized) return '';
    const compacted = normalized.replace(/[-_\s]/g, '');
    if (compacted === 'onsale' || normalized === 'online') return 'online';
    if (compacted === 'activity') return 'activity';
    if (normalized === 'reviewing' || normalized === 'draft' || normalized === 'offline' || normalized === 'sold_out') {
      return normalized;
    }
    return '';
  }

  private getEffectivePrice(work: any, activityJoin?: { discount: number } | null) {
    const price = typeof work?.price === 'number' ? work.price : 0;
    const now = new Date();

    // 1. 作品自身折扣
    let workDiscountPrice: number | null = null;
    const discountPrice = typeof work?.discountPrice === 'number' ? work.discountPrice : null;
    const startAt = work?.discountStartAt ? new Date(work.discountStartAt) : null;
    const endAt = work?.discountEndAt ? new Date(work.discountEndAt) : null;
    if (discountPrice != null && startAt && endAt && now >= startAt && now <= endAt) {
      workDiscountPrice = discountPrice;
    }

    // 2. 活动折扣（如果参加了当前生效活动）
    let activityPrice: number | null = null;
    if (activityJoin && activityJoin.discount >= 1 && activityJoin.discount <= 100) {
      activityPrice = Math.round((price * activityJoin.discount) / 100);
    }

    // 取更低者（更利于买家）
    const candidates = [price];
    if (workDiscountPrice != null) candidates.push(workDiscountPrice);
    if (activityPrice != null) candidates.push(activityPrice);
    return Math.min(...candidates);
  }

  /** 批量查询活动参加记录（支持多活动） */
  private async buildActivityJoinMap(workIds: string[]): Promise<Map<string, { discount: number }>> {
    const map = new Map<string, { discount: number }>();
    if (workIds.length === 0) return map;

    try {
      const now = new Date();
      // 查找所有当前生效活动（支持多活动）
      const activities = await this.prisma.activity.findMany({
        where: {
          enabled: true,
          AND: [
            { OR: [{ startAt: null }, { startAt: { lte: now } }] },
            { OR: [{ endAt: null }, { endAt: { gte: now } }] },
          ],
        },
      });
      if (activities.length === 0) return map;

      const activityIds = activities.map((a) => a.id);
      // 查找这些作品在任一生效活动的参加记录（只查未退出的）
      const joins = await this.prisma.activityJoin.findMany({
        where: {
          activityId: { in: activityIds },
          workId: { in: workIds },
          leftAt: null,
        },
      });
      for (const join of joins) {
        // 每个作品取第一个参加记录（通常只有一个）
        if (!map.has(join.workId)) {
          map.set(join.workId, { discount: join.discount });
        }
      }
    } catch (e) {
      // 查询失败不影响主流程
      console.error('[buildActivityJoinMap] error:', e);
    }
    return map;
  }

  private async buildCreatorNameMap(creatorIds: string[]) {
    const ids = Array.from(new Set((creatorIds || []).filter(Boolean)));
    if (ids.length === 0) return {};
    const rows: any[] = await this.prisma.$queryRaw(Prisma.sql`
      SELECT id, nickname
      FROM User
      WHERE id IN (${Prisma.join(ids)})
    `);
    const map: Record<string, string> = {};
    rows.forEach((r) => {
      if (r && r.id) map[String(r.id)] = r.nickname || '';
    });
    return map;
  }

  private mapWorkOutput(work: any, creatorNameMap: Record<string, string>, activityJoinMap?: Map<string, { discount: number }>) {
    const creatorId = work?.creatorId || '';
    const status = this.getWorkStatus(work);
    const stock = typeof work?.stock === 'number' ? work.stock : 0;
    const images = work?.images;
    let imageCover = '';
    if (Array.isArray(images)) {
      imageCover = images[0] || '';
    } else if (typeof images === 'string') {
      const trimmed = images.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) imageCover = parsed[0] || '';
        } catch (e) {
          // ignore parse errors, fallback below
        }
      } else {
        imageCover = trimmed;
      }
    }
    let coverUrl = work?.coverUrl || work?.cover || imageCover || '';
    if (
      coverUrl &&
      (coverUrl.includes('http://tmp/') ||
        coverUrl.includes('/_tmp/') ||
        coverUrl.includes('/tmp/') ||
        coverUrl.includes('127.0.0.1:61120') ||
        coverUrl.startsWith('wxfile://'))
    ) {
      coverUrl = null;
    }
    const workId = work?.id || '';
    const price = typeof work?.price === 'number' ? work.price : 0;
    const activityJoin = activityJoinMap?.get(workId) || null;
    const effectivePrice = this.getEffectivePrice(work, activityJoin);
    const discountPrice =
      typeof work?.discountPrice === 'number' ? work.discountPrice : null;
    const discountStartAt = work?.discountStartAt
      ? (work.discountStartAt instanceof Date ? work.discountStartAt : new Date(work.discountStartAt))
      : null;
    const discountEndAt = work?.discountEndAt
      ? (work.discountEndAt instanceof Date ? work.discountEndAt : new Date(work.discountEndAt))
      : null;
    return {
      id: workId,
      status,
      title: work?.title || '',
      desc: work?.desc || '',
      price,
      effectivePrice,
      coverUrl,
      stock,
      creatorId,
      creatorName: creatorNameMap[creatorId] || '',
      createdAt: work?.createdAt || null,
      categoryId: work?.categoryId ?? null,
      subCategoryId: work?.subCategoryId ?? null,
      discountPrice,
      discountStartAt: discountStartAt ? discountStartAt.toISOString() : null,
      discountEndAt: discountEndAt ? discountEndAt.toISOString() : null,
      activityDiscount: activityJoin?.discount ?? null,
    };
  }

  async listPublic(params: { q?: string; categoryId?: string; creatorId?: string; page?: number; pageSize?: number; discount?: number; activityCatId?: string; activitySubId?: string; activityOnly?: number }) {
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize || 20)));
    const where: any = {};

    try {
      where.status = 'online';
      const query = typeof params.q === 'string' ? params.q.trim() : '';
      if (query) {
        where.OR = [
          { title: { contains: query } },
          { desc: { contains: query } },
        ];
      }
      if (params.activityCatId) {
        where.categoryId = params.activityCatId;
      } else if (params.categoryId) {
        where.categoryId = params.categoryId;
      }
      // activityOnly=1：仅查询已参加活动的作品（从 ActivityJoin 表）
      if (params.activityOnly === 1) {
        const now = new Date();
        // 查找所有当前生效活动
        const activities = await this.prisma.activity.findMany({
          where: {
            enabled: true,
            AND: [
              { OR: [{ startAt: null }, { startAt: { lte: now } }] },
              { OR: [{ endAt: null }, { endAt: { gte: now } }] },
            ],
          },
        });
        if (activities.length === 0) {
          return { page, pageSize, total: 0, items: [] };
        }
        const activityIds = activities.map((a) => a.id);
        // 查找这些活动的参加记录（排除已退出的）
        const joins = await this.prisma.activityJoin.findMany({
          where: { activityId: { in: activityIds }, leftAt: null },
          select: { workId: true },
        });
        const joinedWorkIds = joins.map((j) => j.workId);
        if (joinedWorkIds.length === 0) {
          return { page, pageSize, total: 0, items: [] };
        }
        where.id = { in: joinedWorkIds };
      } else if (params.discount === 1) {
        // 旧逻辑：折扣商品
        const now = new Date();
        where.discountPrice = { not: null };
        where.discountStartAt = { lte: now };
        where.discountEndAt = { gte: now };
      }
      if (params.activitySubId) {
        where.subCategoryId = params.activitySubId;
      }
      // 作者页：按 creatorId 过滤
      if (params.creatorId) {
        where.creatorId = params.creatorId;
      }
      console.log('[works.listPublic] where=', where);
      const [items, total] = await Promise.all([
        this.prisma.work.findMany({
          where,
          orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { favorites: true, orderItems: true },
        }),
        this.prisma.work.count({ where }),
      ]);
      console.log('[works.listPublic] rows=', items.length);

      const creatorIds = items.map((w) => w.creatorId || '').filter(Boolean);
      const workIds = items.map((w) => w.id).filter(Boolean);
      const [creatorNameMap, activityJoinMap] = await Promise.all([
        this.buildCreatorNameMap(creatorIds),
        this.buildActivityJoinMap(workIds),
      ]);
      const mapped = items.map((work) => this.mapWorkOutput(work, creatorNameMap, activityJoinMap));

      return { page, pageSize, total, items: mapped };
    } catch (e: any) {
      // 关键：把真实错误打印出来，便于定位
      console.error('[works.listPublic] failed:', e?.message || e);
      if (e?.stack) console.error(e.stack);
      return { page, pageSize, total: 0, items: [] };
    }
  }

  async getPublic(id: string) {
    const work = await this.prisma.work.findFirst({
      where: { id, status: 'online' },
      include: { favorites: true, orderItems: true },
    });
    if (!work) throw new NotFoundException('work_not_found');
    const [creatorNameMap, activityJoinMap] = await Promise.all([
      this.buildCreatorNameMap([work.creatorId || '']),
      this.buildActivityJoinMap([work.id]),
    ]);
    const mapped = this.mapWorkOutput(work, creatorNameMap, activityJoinMap);
    
    // 补充 creator 对象供详情页使用
    if (work.creatorId) {
      const creatorRow = await this.prisma.user.findUnique({
        where: { id: work.creatorId },
        select: { id: true, nickname: true },
      });
      if (creatorRow) {
        (mapped as any).creator = {
          id: creatorRow.id,
          nickname: creatorRow.nickname || '匿名作者',
        };
      }
    }
    const w: any = work as any;
    const invStock =
      w && w.inventory && typeof w.inventory.stock === 'number' ? w.inventory.stock : null;
    const directStock = typeof w?.stock === 'number' ? w.stock : null;
    const source = invStock != null ? 'inventory' : (directStock != null ? 'direct' : 'zero-fallback');
    console.log(
      `[stock-source] from=${source} workId=${w?.id || ''} status=${w?.status || ''} stock=${w?.stock} inventory=${JSON.stringify(w?.inventory || null)} inventoryStock=${w?.inventory?.stock} outputStock=${mapped.stock}`,
    );
    console.log('[works.getPublic] workId=', id, 'status=', mapped.status, 'coverUrl=', mapped.coverUrl, 'stock=', mapped.stock);
    return mapped;
  }

  async listMine(params: { userId: string; status?: string; user?: any }) {
    const rawStatus = typeof params.status === 'string' ? params.status : '';
    const user = params.user || {};
    const userId = String(params.userId || '').trim();
    try {
      const creatorId = await this.assertCreatorApproved(userId);
      if (!creatorId) {
        console.error('[works.listMine] no creatorId');
        console.error('[works.listMine] rawStatus=', rawStatus);
        console.error('[works.listMine] user=', {
          id: user.id ?? user.sub ?? '',
          creatorId: user.creatorId,
          creator: user.creator && user.creator.id ? { id: user.creator.id } : undefined,
          openId: user.openId,
        });
        return [];
      }
      console.log('[works.listMine] creatorId=', creatorId, 'rawStatus=', rawStatus);
      const where: any = { creatorId };
      const normalizedStatus = this.normalizeStatusFilter(rawStatus);
      if (normalizedStatus === 'activity') {
        const now = new Date();
        where.status = 'online';
        where.discountPrice = { not: null };
        where.discountStartAt = { lte: now };
        where.discountEndAt = { gte: now };
      } else if (normalizedStatus) {
        where.status = normalizedStatus;
      }
      const items = await this.prisma.work.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      const creatorIds = items.map((w) => w.creatorId || '').filter(Boolean);
      const creatorNameMap = await this.buildCreatorNameMap(creatorIds);
      return items.map((work) => this.mapWorkOutput(work, creatorNameMap));
    } catch (e: any) {
      console.error('[works.listMine] error=', e);
      if (e?.stack) console.error(e.stack);
      console.error('[works.listMine] rawStatus=', rawStatus);
      console.error('[works.listMine] user=', {
        id: user.id ?? user.sub ?? '',
        creatorId: user.creatorId,
        creator: user.creator && user.creator.id ? { id: user.creator.id } : undefined,
        openId: user.openId,
      });
      return [];
    }
  }

  private async assertCreatorApproved(userId: string): Promise<string> {
    if (!userId) return '';
    try {
      // 检查用户是否存在
      const rows = await this.prisma.$queryRaw(Prisma.sql`
        SELECT id FROM User WHERE id = ${userId} LIMIT 1
      `);
      const foundId = Array.isArray(rows) && rows[0] && rows[0].id ? String(rows[0].id) : '';
      if (!foundId) return userId || '';

      // [卖家管理] 检查 CreatorProfile 状态
      const profiles: any[] = await this.prisma.$queryRaw(Prisma.sql`
        SELECT status FROM CreatorProfile WHERE userId = ${foundId} LIMIT 1
      `);
      if (profiles && profiles.length > 0) {
        const rawStatus = profiles[0].status;
        const status = rawStatus ? String(rawStatus).toLowerCase() : '';
        if (status !== 'approved') {
          const statusTextMap: Record<string, string> = {
            pending: '卖家资质审核中',
            rejected: '卖家资质已被拒绝',
            frozen: '卖家已被冻结',
            banned: '卖家已被封禁',
          };
          throw new BadRequestException(statusTextMap[status] || '卖家不可发布');
        }
      }
      // 如果没有 CreatorProfile 记录，仍然允许操作（兼容旧数据）

      return foundId;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      // 保持最小兜底：找不到映射则退回 userId
    }
    return userId || '';
  }

  /** 我的作品详情：仅当前用户、任意 status，非本人 404 */
  async getMine(userId: string, workId: string) {
    const creatorId = await this.assertCreatorApproved(userId);
    if (!creatorId) throw new NotFoundException('work_not_found');
    const work = await this.prisma.work.findFirst({
      where: { id: workId, creatorId },
    });
    if (!work) throw new NotFoundException('work_not_found');
    const creatorNameMap = await this.buildCreatorNameMap([work.creatorId || ''].filter(Boolean));
    const mapped = this.mapWorkOutput(work, creatorNameMap);
    const w = work as any;
    const coverUrl = mapped.coverUrl || w.coverUrl || '';
    const images = coverUrl ? [coverUrl] : [];
    return {
      ...mapped,
      desc: w.desc ?? '',
      cover: coverUrl,
      coverUrl,
      images,
      support7days: w.support7days == null ? true : !!w.support7days,
    };
  }

  async upsertDraft(userId: string, dto: UpsertWorkDto) {
    const creatorId = await this.assertCreatorApproved(userId);
    if (!creatorId) throw new BadRequestException('user_not_found');

    const title = typeof dto?.title === 'string' ? dto.title.trim() : '';
    const price = typeof dto?.price === 'number' ? dto.price : Number(dto?.price);
    const stock = Math.max(0, Number((dto as any)?.stock) || 0);
    const hasStockField = Object.prototype.hasOwnProperty.call(dto || {}, 'stock');
    if (!title) throw new BadRequestException('title_required');
    if (!Number.isFinite(price) || price <= 0) throw new BadRequestException('price_invalid');
    if (dto.id) {
      try {
        const existing = await this.prisma.work.findUnique({ where: { id: dto.id } });
        if (!existing) {
          console.error('[works.upsertDraft] fallback_create for missing id:', dto.id);
          const newId = `w_${Date.now()}`;
          console.log('[works.upsertDraft] create', { userId, creatorId, workId: newId });
          const createData: any = {
            id: newId,
            creatorId,
            title,
            desc: dto.desc || null,
            price,
            stock,
            support7days: dto.support7days == null ? true : !!dto.support7days,
            status: 'draft',
            coverUrl: dto.images && dto.images[0] ? dto.images[0] : null,
            categoryId: dto.categoryId || null,
            subCategoryId: dto.subCategoryId || null,
          };
          const created = await this.prisma.work.create({ data: createData });
          console.log('[PROOF][server saved]', created.price, created.id);
          console.log(`[works] write creatorId=${creatorId} workId=${newId} status=draft`);
          return { id: newId };
        }
        const updateData: any = {
          title,
          desc: dto.desc || null,
          price,
          support7days: dto.support7days == null ? true : !!dto.support7days,
          creatorId,
          categoryId: dto.categoryId || null,
          subCategoryId: dto.subCategoryId || null,
          coverUrl: dto.images && dto.images[0] ? dto.images[0] : null,
        };
        if (hasStockField) updateData.stock = stock;
        const updated = await this.prisma.work.update({ where: { id: dto.id }, data: updateData });
        console.log('[PROOF][server saved]', updated.price, updated.id);
        console.log('[works.upsertDraft] update', { userId, creatorId, workId: dto.id });
        console.log(`[works] write creatorId=${creatorId} workId=${dto.id} status=draft`);
        void userId;
        return { id: dto.id };
      } catch (e: any) {
        console.error('[works.upsertDraft] failed', e);
        if (e?.stack) console.error(e.stack);
        throw new BadRequestException('work_upsert_failed');
      }
    }

    const newId = `w_${Date.now()}`;
    try {
      console.log('[works.upsertDraft] create', { userId, creatorId, workId: newId });
      const createData: any = {
        id: newId,
        creatorId,
        title,
        desc: dto.desc || null,
        price,
        stock,
        support7days: dto.support7days == null ? true : !!dto.support7days,
        status: 'draft',
        coverUrl: dto.images && dto.images[0] ? dto.images[0] : null,
        categoryId: dto.categoryId || null,
        subCategoryId: dto.subCategoryId || null,
      };
      const created = await this.prisma.work.create({ data: createData });
      console.log('[PROOF][server saved]', created.price, created.id);
      console.log(`[works] write creatorId=${creatorId} workId=${newId} status=draft`);
      return { id: newId };
    } catch (e: any) {
      console.error('[works.upsertDraft] failed', e);
      if (e?.stack) console.error(e.stack);
      throw new BadRequestException('work_upsert_failed');
    }
  }

  async submitReview(userId: string, workId: string) {
    const creatorId = await this.assertCreatorApproved(userId);
    if (!creatorId) throw new BadRequestException('user_not_found');
    const existing = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!existing) throw new NotFoundException('work_not_found');
    console.log('[works.submitReview] creatorId=', creatorId, 'userId=', userId, 'workId=', workId, 'workCreatorId=', existing.creatorId || '');
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE Work SET status = 'reviewing', updatedAt = UTC_TIMESTAMP(3) WHERE id = ${workId}
    `);
    console.log(`[works] write creatorId=${creatorId} workId=${workId} status=reviewing`);
    return { id: workId, status: 'reviewing' };
  }

  async deleteMine(userId: string, workId: string) {
    const creatorId = await this.assertCreatorApproved(userId);
    if (!creatorId) throw new UnauthorizedException('unauthorized');
    const existing = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!existing) throw new NotFoundException('work_not_found');
    if ((existing as any).creatorId !== creatorId) throw new UnauthorizedException('只能删除自己的作品');

    await this.prisma.work.delete({ where: { id: workId } });
    return { ok: true };
  }

  // Admin
  async adminList(params: { q?: string; status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize || 20)));
    const rawStatus = typeof params.status === 'string' ? params.status : '';
    const normalizedStatus = this.normalizeStatusFilter(rawStatus) || 'reviewing';
    const statusForQuery = normalizedStatus;
    const isStatusQuery = true;

    try {
      console.log('[admin.works] rawStatus=', rawStatus, 'usedStatus=', statusForQuery || '(none)');
      console.log('[admin.works] where=', { status: statusForQuery });

      if (!adminListDiagnosticsPrinted) {
        adminListDiagnosticsPrinted = true;
        const url = process.env.DATABASE_URL || '';
        const masked = url.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
        const hostMatch = url.match(/@([^:/]+)(?::(\d+))?\/([^?]+)/);
        const host = hostMatch ? hostMatch[1] : 'unknown';
        const db = hostMatch ? hostMatch[3] : 'unknown';
        console.log('[admin.works] DATABASE_URL(masked)=', masked);
        console.log('[admin.works] DB host/db=', host, '/', db);

        const recent = await this.prisma.$queryRaw(Prisma.sql`
          SELECT id, status, title, creatorId, createdAt
          FROM Work
          ORDER BY createdAt DESC
          LIMIT 10
        `);
        console.log('[admin.works] recent_works(10)=', recent);
      }

      const items = await this.prisma.$queryRaw(Prisma.sql`
        SELECT w.id, w.status, w.title, w.price, w.stock, w.creatorId, w.coverUrl, w.createdAt
        FROM Work AS w
        WHERE LOWER(w.status) = LOWER(${statusForQuery})
        ORDER BY w.createdAt DESC
        LIMIT 50
      `);
      console.log('[admin.works] rows=', Array.isArray(items) ? items.length : 0);
      const creatorIds = (items as any[]).map((w) => w.creatorId || '').filter(Boolean);
      const creatorNameMap = await this.buildCreatorNameMap(creatorIds);
      return (items as any[]).map((work) => this.mapWorkOutput(work, creatorNameMap));
    } catch (e) {
      return isStatusQuery ? [] : { page, pageSize, total: 0, items: [] };
    }
  }

  async adminApprove(workId: string) {
    const existing = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!existing) throw new NotFoundException('work_not_found');
    const currentStatus = String((existing as any).status || '').toLowerCase();
    if (currentStatus && currentStatus !== 'reviewing') {
      throw new BadRequestException('work_status_not_reviewing');
    }
    const updated = await this.prisma.work.update({
      where: { id: workId },
      data: { status: 'online' },
    });
    const statusOut = this.getWorkStatus(updated);
    console.log('[works.adminApprove] workId=', workId, 'status_db=online', 'status_out=', statusOut);
    return { id: updated.id, status: statusOut };
  }

  async adminReject(workId: string, reason?: string) {
    const existing = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!existing) throw new NotFoundException('work_not_found');
    const currentStatus = String((existing as any).status || '').toLowerCase();
    if (currentStatus && currentStatus !== 'reviewing') {
      throw new BadRequestException('work_status_not_reviewing');
    }
    const updated = await this.prisma.work.update({
      where: { id: workId },
      data: { status: 'offline' },
    });
    const statusOut = this.getWorkStatus(updated);
    void reason;
    return { id: updated.id, status: statusOut };
  }

  async adminUpdateWeight(workId: string, weight: number) {
    const existing = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!existing) throw new NotFoundException('work_not_found');
    return this.prisma.work.update({
      where: { id: workId },
      data: { weight },
    });
  }

  async adminUpdateDiscount(
    workId: string,
    dto: { discountPrice?: number | null; discountStartAt?: string | null; discountEndAt?: string | null },
  ) {
    const existing = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!existing) throw new NotFoundException('work_not_found');

    const hasPrice = dto.discountPrice != null;
    const hasStart = dto.discountStartAt != null;
    const hasEnd = dto.discountEndAt != null;
    const allEmpty = !hasPrice && !hasStart && !hasEnd;
    const allSet = hasPrice && hasStart && hasEnd;

    if (!allEmpty && !allSet) {
      throw new BadRequestException('discount_fields_must_all_set_or_all_null');
    }

    if (allEmpty) {
      return this.prisma.work.update({
        where: { id: workId },
        data: { discountPrice: null, discountStartAt: null, discountEndAt: null },
      });
    }

    return this.prisma.work.update({
      where: { id: workId },
      data: {
        discountPrice: dto.discountPrice as number,
        discountStartAt: dto.discountStartAt ? new Date(dto.discountStartAt) : null,
        discountEndAt: dto.discountEndAt ? new Date(dto.discountEndAt) : null,
      },
    });
  }

  /** 创作者自助设置活动折扣：仅限本人、status=online，折扣在活动配置范围内 */
  async setDiscountByCreator(
    workId: string,
    userId: string,
    discountPercent: number,
  ) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('work_not_found');
    if (work.creatorId !== userId) {
      throw new BadRequestException('只能设置自己作品的折扣');
    }
    if (work.status !== 'online') {
      throw new BadRequestException('只能对已上架作品设置活动折扣');
    }
    const activity = await this.config.getActivity();
    const disc = activity.discount || {};
    if (!disc.enabled) {
      throw new BadRequestException('当前未开放活动');
    }
    const min = Math.max(1, disc.discountMin ?? 70);
    const max = Math.min(100, disc.discountMax ?? 95);
    if (discountPercent < min || discountPercent > max) {
      throw new BadRequestException(`折扣须在 ${min} 折到 ${max} 折之间`);
    }
    const price = typeof work.price === 'number' ? work.price : 0;
    if (price <= 0) throw new BadRequestException('作品价格无效');
    const discountPrice = Math.round((price * discountPercent) / 100);
    const now = new Date();
    const endAt = new Date(now);
    const durationDays = Math.max(1, disc.durationDays || 7);
    endAt.setDate(endAt.getDate() + durationDays);
    return this.prisma.work.update({
      where: { id: workId },
      data: {
        discountPrice,
        discountStartAt: now,
        discountEndAt: endAt,
      },
    });
  }

  /** 创作者降价：新价必须低于原价，立即生效，与活动无关 */
  async setPriceByCreator(workId: string, userId: string, newPriceCents: number) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('work_not_found');
    const creatorId = await this.assertCreatorApproved(userId);
    if (!creatorId || (work as any).creatorId !== creatorId) {
      throw new UnauthorizedException('只能修改自己的作品');
    }
    const currentPrice = typeof (work as any).price === 'number' ? (work as any).price : 0;
    if (currentPrice <= 0) throw new BadRequestException('作品价格无效');
    if (!Number.isInteger(newPriceCents) || newPriceCents <= 0) {
      throw new BadRequestException('新价格必须为正整数');
    }
    if (newPriceCents >= currentPrice) {
      throw new BadRequestException('新价格必须低于当前价格');
    }
    await this.prisma.work.update({
      where: { id: workId },
      data: { price: newPriceCents },
    });
    return { id: workId, price: newPriceCents };
  }

  // ========== 已上架作品管理（新增，不影响审核流程） ==========

  /** 获取已上架作品列表（分页，可选筛选） */
  async adminListOnline(params: {
    keyword?: string;
    authorId?: string;
    categoryId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { keyword, authorId, categoryId, page = 1, pageSize = 20 } = params;
    const where: any = { status: 'online' };

    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { id: { contains: keyword } },
      ];
    }
    if (authorId) {
      where.creatorId = authorId;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.work.findMany({
        where,
        orderBy: [{ weight: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.work.count({ where }),
    ]);

    // 构建 creatorNameMap 用于显示作者信息
    const creatorIds = [...new Set(items.map((w) => w.creatorId).filter(Boolean))];
    const creatorNameMap = await this.buildCreatorNameMap(creatorIds as string[]);

    return {
      items: items.map((w) => this.mapWorkOutput(w, creatorNameMap)),
      total,
      page,
      pageSize,
    };
  }

  /** 运营下架作品 */
  async adminOfflineWork(workId: string, reason: string, adminId?: string | null) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('下架原因不能为空');
    }

    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('work_not_found');
    if (work.status !== 'online') {
      throw new BadRequestException('只能下架已上架的作品');
    }

    const now = new Date();

    // 更新作品状态
    await this.prisma.work.update({
      where: { id: workId },
      data: {
        status: 'offline',
        offlineReason: reason.trim(),
        offlineAt: now,
        offlineBy: adminId || null,
      },
    });

    // 发送站内通知给作者
    const creatorId = work.creatorId;
    if (creatorId) {
      await this.prisma.notice.create({
        data: {
          userId: creatorId,
          type: 'work_offline',
          title: '作品下架通知',
          content: `您的作品「${work.title || '未命名作品'}」已被下架。\n下架原因：${reason.trim()}`,
          workId: workId,
        },
      });
    }

    return { ok: true, workId, status: 'offline', offlineAt: now.toISOString() };
  }

  /** 后台只读：作品详情（用于审核页/运营查看） */
  async adminGet(workId: string) {
    const id = String(workId || '').trim();
    if (!id) throw new BadRequestException('workId_required');
    const work: any = await this.prisma.work.findUnique({ where: { id } });
    if (!work) throw new NotFoundException('work_not_found');

    const creatorId = String(work.creatorId || '');
    const creatorNameMap = await this.buildCreatorNameMap(creatorId ? [creatorId] : []);
    const mapped: any = this.mapWorkOutput(work, creatorNameMap);

    const coverUrl = mapped.coverUrl || work.coverUrl || '';
    const images = coverUrl ? [coverUrl] : [];

    return {
      ...mapped,
      // keep extra fields for admin detail view
      desc: work.desc || '',
      cover: coverUrl,
      images,
      createdAt: work.createdAt ? (work.createdAt instanceof Date ? work.createdAt.toISOString() : String(work.createdAt)) : null,
      updatedAt: work.updatedAt ? (work.updatedAt instanceof Date ? work.updatedAt.toISOString() : String(work.updatedAt)) : null,
    };
  }
}

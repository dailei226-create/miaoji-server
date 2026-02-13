import { Category } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ActivityBannerConfig {
  enabled: boolean;
  image: string;
  linkType: 'webview' | 'mini' | 'none';
  link: string;
  appId: string;
  path: string;
  version: string;
}

export interface ActivityDiscountConfig {
  enabled: boolean;
  discountMin: number;
  discountMax: number;
  version: string;
  durationDays: number;
}

export interface ActivityCategoryChild {
  id: string;
  name: string;
  weight: number;
}

export interface ActivityCategory {
  id: string;
  name: string;
  weight: number;
  children: ActivityCategoryChild[];
}

export interface ActivityConfig {
  banner: ActivityBannerConfig;
  discount: ActivityDiscountConfig;
  categories: ActivityCategory[];
}

export interface MarketCategoryChild {
  id: string;
  name: string;
  weight: number;
  enabled?: boolean;
}

export interface MarketCategory {
  id: string;
  name: string;
  weight: number;
  enabled?: boolean;
  children: MarketCategoryChild[];
}

function emptyActivityConfig(categories: ActivityCategory[]): ActivityConfig {
  return {
    banner: {
      enabled: false,
      image: '',
      linkType: 'none',
      link: '',
      appId: '',
      path: '',
      version: '1',
    },
    discount: {
      enabled: false,
      discountMin: 70,
      discountMax: 95,
      version: '1',
      durationDays: 7,
    },
    categories,
  };
}

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  /** 从 DB 构建集市类目树（一级 weight 倒序，二级 weight 倒序）；当前排序仅用 weight，预留 dynamicWeight/behaviorScore */
  async getMarketCategoriesTree(): Promise<MarketCategory[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { weight: 'desc' },
    });
    const byParent = new Map<string | null, typeof rows>();
    for (const r of rows) {
      const pid = r.parentId ?? null;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(r);
    }
    const roots = (byParent.get(null) || []).sort((a: Category, b: Category) => (b.weight ?? 0) - (a.weight ?? 0));
    return roots.map((r) => ({
      id: r.id,
      name: r.name,
      weight: r.weight ?? 0,
      enabled: true,
      children: (byParent.get(r.id) || [])
        .sort((a: Category, b: Category) => (b.weight ?? 0) - (a.weight ?? 0))
        .map((c) => ({ id: c.id, name: c.name, weight: c.weight ?? 0, enabled: true })),
    }));
  }

  /** 活动用：在集市类目树中筛出「可参加」的一级类目（id 或任一子 id 在 activityCategoryIds 中），按一级 weight 倒序 */
  async getActivityCategoriesTree(activityCategoryIds: string[]): Promise<ActivityCategory[]> {
    const set = new Set(activityCategoryIds || []);
    if (set.size === 0) return [];
    const full = await this.getMarketCategoriesTree();
    const out: ActivityCategory[] = [];
    for (const root of full) {
      const selfIn = set.has(root.id);
      const childIn = root.children.some((c) => set.has(c.id));
      if (selfIn || childIn) out.push({ ...root, children: root.children });
    }
    return out; // 已按 weight desc
  }

  /** 读取当前启用且在时间窗内的所有活动，聚合类目，返回与前端/卖家侧兼容的 activity 结构 */
  async getActivity(): Promise<ActivityConfig> {
    const now = new Date();
    // 多活动支持：查询所有当前生效活动
    const rows = await this.prisma.activity.findMany({
      where: {
        enabled: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
    });

    // 聚合所有活动的 categoryIds
    const allCategoryIds = new Set<string>();
    for (const r of rows) {
      const ids = (r.categoryIds as string[] | null) || [];
      ids.forEach((id) => allCategoryIds.add(id));
    }
    const categoryIds = Array.from(allCategoryIds);
    const categories = await this.getActivityCategoriesTree(categoryIds);
    const row = rows[0] || null; // 主活动用于 banner 等信息

    if (!row) return emptyActivityConfig(categories);

    const linkTypeRaw = (row as any).linkType as string | null;
    const linkType =
      linkTypeRaw === 'webview' || linkTypeRaw === 'mini' ? linkTypeRaw : 'none';
    const discountMin = Math.max(
      1,
      Math.min(100, (row as any).discountMin ?? 70),
    );
    const discountMax = Math.max(
      1,
      Math.min(100, (row as any).discountMax ?? 95),
    );
    const durationDays = Math.max(
      1,
      Math.min(365, (row as any).durationDays ?? 7),
    );

    return {
      banner: {
        enabled: row.enabled,
        image: row.imageUrl || '',
        linkType,
        link: row.linkUrl || '',
        appId: (row as any).appId || '',
        path: (row as any).path || '',
        version: '1',
      },
      discount: {
        enabled: row.enabled,
        discountMin,
        discountMax,
        version: '1',
        durationDays,
      },
      categories,
    };
  }
}

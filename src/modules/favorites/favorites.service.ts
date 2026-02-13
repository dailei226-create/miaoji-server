import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  private getEffectivePrice(work: {
    price?: number | null;
    discountPrice?: number | null;
    discountStartAt?: Date | string | null;
    discountEndAt?: Date | string | null;
  }) {
    const price = typeof work?.price === 'number' ? work.price : 0;
    const discountPrice =
      typeof work?.discountPrice === 'number' ? work.discountPrice : null;
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

  private getWorkStatus(work: { orderItems?: unknown[] }) {
    return work.orderItems && work.orderItems.length > 0 ? 'sold_out' : 'on_sale';
  }

  async add(userId: string, workId: string) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('work_not_found');

    // 重新收藏时更新 createdAt，确保排序稳定反映最新收藏时间
    const favorite = await this.prisma.favorite.upsert({
      where: { userId_workId: { userId, workId } },
      update: { createdAt: new Date() },
      create: { userId, workId },
    });

    return favorite;
  }

  async remove(userId: string, workId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, workId } });
    return { ok: true };
  }

  async list(userId: string) {
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
}

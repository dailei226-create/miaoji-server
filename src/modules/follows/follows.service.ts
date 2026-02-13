import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  async add(userId: string, creatorId: string) {
    const creator = await this.prisma.user.findUnique({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('creator_not_found');

    const follow = await this.prisma.follow.upsert({
      where: { userId_creatorId: { userId, creatorId } },
      update: {},
      create: { userId, creatorId },
    });

    return follow;
  }

  async remove(userId: string, creatorId: string) {
    await this.prisma.follow.deleteMany({ where: { userId, creatorId } });
    return { ok: true };
  }

  async list(userId: string) {
    const items = await this.prisma.follow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { creator: true },
    });

    const creators = items.map((item) => ({
      id: item.creator.id,
      createdAt: item.creator.createdAt,
    }));

    return { items: creators };
  }
}

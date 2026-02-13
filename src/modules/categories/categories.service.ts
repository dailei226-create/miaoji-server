import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async listTree() {
    const rows = await this.prisma.category.findMany({
      orderBy: { weight: 'desc' },
    });
    const byParent = new Map<string | null, typeof rows>();
    for (const r of rows) {
      const pid = r.parentId ?? null;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(r);
    }
    const roots = (byParent.get(null) || []).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    return roots.map((r) => ({
      id: r.id,
      name: r.name,
      weight: r.weight ?? 0,
      parentId: r.parentId,
      children: (byParent.get(r.id) || [])
        .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
        .map((c) => ({
          id: c.id,
          name: c.name,
          weight: c.weight ?? 0,
          parentId: c.parentId,
        })),
    }));
  }

  async create(data: { name: string; weight?: number; parentId?: string | null }) {
    if (!data.name?.trim()) throw new BadRequestException('name_required');
    if (data.parentId != null && data.parentId !== '') {
      const parent = await this.prisma.category.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new BadRequestException('parent_not_found');
    }
    return this.prisma.category.create({
      data: {
        name: data.name.trim(),
        weight: typeof data.weight === 'number' ? data.weight : 0,
        parentId: data.parentId?.trim() || null,
      },
    });
  }

  async update(id: string, data: { name?: string; weight?: number }) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('category_not_found');
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.weight !== undefined) payload.weight = data.weight;
    return this.prisma.category.update({ where: { id }, data: payload });
  }

  async adjustWeight(id: string, delta: number) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('category_not_found');
    const next = Math.max(0, (existing.weight ?? 0) + delta);
    return this.prisma.category.update({
      where: { id },
      data: { weight: next },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('category_not_found');
    const children = await this.prisma.category.count({ where: { parentId: id } });
    if (children > 0) throw new BadRequestException('请先删除或移出子类目');
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }
}

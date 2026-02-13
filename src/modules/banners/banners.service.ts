import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto, BannerPosition } from './dto';

@Injectable()
export class BannersService {
  constructor(private prisma: PrismaService) {}

  /** 公开接口：按 position 获取启用的 Banner 列表 */
  async listPublic(position?: BannerPosition) {
    const where: any = { enabled: true };
    if (position) where.position = position;
    const items = await this.prisma.banner.findMany({
      where,
      orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }],
    });
    return items;
  }

  /** 后台：获取所有 Banner 列表 */
  async listAdmin(position?: BannerPosition) {
    const where: any = {};
    if (position) where.position = position;
    const items = await this.prisma.banner.findMany({
      where,
      orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }],
    });
    return items;
  }

  /** 后台：创建 Banner */
  async create(dto: CreateBannerDto) {
    if (!dto?.imageUrl) throw new BadRequestException('imageUrl_required');
    if (!dto?.position) throw new BadRequestException('position_required');
    if (!dto?.targetType) throw new BadRequestException('targetType_required');
    return this.prisma.banner.create({
      data: {
        title: dto.title ?? null,
        imageUrl: dto.imageUrl,
        position: dto.position as any,
        targetType: dto.targetType as any,
        targetId: dto.targetId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        enabled: dto.enabled ?? true,
      },
    });
  }

  /** 后台：更新 Banner */
  async update(id: number, dto: UpdateBannerDto) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('banner_not_found');
    if (dto.imageUrl === '') throw new BadRequestException('imageUrl_required');
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.targetType !== undefined) data.targetType = dto.targetType;
    if (dto.targetId !== undefined) data.targetId = dto.targetId;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    return this.prisma.banner.update({ where: { id }, data });
  }

  /** 后台：启用/停用 Banner */
  async setEnabled(id: number, enabled: boolean) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('banner_not_found');
    return this.prisma.banner.update({ where: { id }, data: { enabled } });
  }

  /** 后台：更新排序 */
  async updateSort(id: number, sortOrder: number) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('banner_not_found');
    return this.prisma.banner.update({ where: { id }, data: { sortOrder } });
  }

  /** 后台：删除 Banner */
  async remove(id: number) {
    await this.prisma.banner.delete({ where: { id } });
    return { ok: true };
  }
}

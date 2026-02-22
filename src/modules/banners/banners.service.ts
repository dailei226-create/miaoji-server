import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto, BannerPosition } from './dto';

@Injectable()
export class BannersService {
  constructor(private prisma: PrismaService) {}

  private assertTargetValid(targetType: string, targetId?: string, linkUrl?: string) {
    const t = String(targetType || '').trim();
    const id = (targetId == null) ? '' : String(targetId).trim();
    const url = (linkUrl == null) ? '' : String(linkUrl).trim();

    const needsId = new Set(['CREATOR', 'AUTHOR', 'WORK', 'WORK_DETAIL', 'CATEGORY', 'CATEGORY_L1', 'CATEGORY_L2']);
    if (t === 'H5') {
      if (!url) throw new BadRequestException('linkUrl_required_for_h5');
      if (!/^https?:\/\//i.test(url)) throw new BadRequestException('linkUrl_invalid');
      return;
    }
    if (t === 'NONE') return;
    if (needsId.has(t)) {
      if (!id) throw new BadRequestException('targetId_required');
      return;
    }
    // Other types (e.g. TOPIC_NEW) do not require targetId/linkUrl.
  }

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
    this.assertTargetValid(dto.targetType, dto.targetId, dto.linkUrl);
    return this.prisma.banner.create({
      data: {
        title: dto.title ?? null,
        imageUrl: dto.imageUrl,
        linkUrl: dto.linkUrl ? String(dto.linkUrl).trim() : null,
        position: dto.position as any,
        targetType: dto.targetType as any,
        targetId: dto.targetId ? String(dto.targetId).trim() : null,
        sortOrder: dto.sortOrder ?? 0,
        enabled: dto.enabled ?? true,
      },
    });
  }

  /** 后台：更新 Banner */
  async update(id: string, dto: UpdateBannerDto) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('banner_not_found');
    if (dto.imageUrl === '') throw new BadRequestException('imageUrl_required');
    const nextType = dto.targetType !== undefined ? dto.targetType : (existing as any).targetType;
    const nextId =
      dto.targetId !== undefined
        ? (dto.targetId ? String(dto.targetId).trim() : '')
        : ((existing as any).targetId ? String((existing as any).targetId).trim() : '');
    const nextUrl =
      dto.linkUrl !== undefined
        ? (dto.linkUrl ? String(dto.linkUrl).trim() : '')
        : ((existing as any).linkUrl ? String((existing as any).linkUrl).trim() : '');
    this.assertTargetValid(String(nextType || ''), nextId, nextUrl);
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.linkUrl !== undefined) data.linkUrl = dto.linkUrl ? String(dto.linkUrl).trim() : null;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.targetType !== undefined) data.targetType = dto.targetType;
    if (dto.targetId !== undefined) data.targetId = dto.targetId ? String(dto.targetId).trim() : null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    return this.prisma.banner.update({ where: { id }, data });
  }

  /** 后台：启用/停用 Banner */
  async setEnabled(id: string, enabled: boolean) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('banner_not_found');
    return this.prisma.banner.update({ where: { id }, data: { enabled } });
  }

  /** 后台：更新排序 */
  async updateSort(id: string, sortOrder: number) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('banner_not_found');
    return this.prisma.banner.update({ where: { id }, data: { sortOrder } });
  }

  /** 后台：删除 Banner */
  async remove(id: string) {
    await this.prisma.banner.delete({ where: { id } });
    return { ok: true };
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UpsertAddressDto } from './dto';

type AddressRecord = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  province: string | null;
  city: string | null;
  district: string | null;
  detail: string;
  postalCode: string | null;
  tag: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AddressesService {
  private store = new Map<string, AddressRecord>();

  private listByUser(userId: string) {
    return Array.from(this.store.values())
      .filter((item) => item.userId === userId)
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
  }

  async list(userId: string) {
    return this.listByUser(userId);
  }

  async upsert(userId: string, dto: UpsertAddressDto) {
    const makeDefault = !!dto.isDefault;

    if (dto.id) {
      const existing = this.store.get(dto.id);
      if (!existing) throw new NotFoundException('address_not_found');
      if (existing.userId !== userId) throw new ForbiddenException('not_owner');

      const updated: AddressRecord = {
        ...existing,
        name: dto.name,
        phone: dto.phone,
        province: dto.province ?? null,
        city: dto.city ?? null,
        district: dto.district ?? null,
        detail: dto.detail,
        postalCode: dto.postalCode ?? null,
        tag: dto.tag ?? null,
        isDefault: makeDefault ? true : existing.isDefault,
        updatedAt: new Date(),
      };
      this.store.set(updated.id, updated);

      if (makeDefault) await this.setDefault(userId, updated.id);
      return updated;
    }

    const now = new Date();
    const created: AddressRecord = {
      id: randomUUID(),
      userId,
      name: dto.name,
      phone: dto.phone,
      province: dto.province ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      detail: dto.detail,
      postalCode: dto.postalCode ?? null,
      tag: dto.tag ?? null,
      isDefault: makeDefault,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(created.id, created);
    if (makeDefault) await this.setDefault(userId, created.id);
    return created;
  }

  async setDefault(userId: string, addressId: string) {
    const addr = this.store.get(addressId);
    if (!addr) throw new NotFoundException('address_not_found');
    if (addr.userId !== userId) throw new ForbiddenException('not_owner');

    for (const item of this.store.values()) {
      if (item.userId !== userId) continue;
      this.store.set(item.id, {
        ...item,
        isDefault: item.id === addressId,
        updatedAt: new Date(),
      });
    }

    return { ok: true };
  }

  async remove(userId: string, addressId: string) {
    const addr = this.store.get(addressId);
    if (!addr) throw new NotFoundException('address_not_found');
    if (addr.userId !== userId) throw new ForbiddenException('not_owner');

    this.store.delete(addressId);
    return { ok: true };
  }
}

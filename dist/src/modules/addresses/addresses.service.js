"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressesService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let AddressesService = class AddressesService {
    constructor() {
        this.store = new Map();
    }
    listByUser(userId) {
        return Array.from(this.store.values())
            .filter((item) => item.userId === userId)
            .sort((a, b) => {
            if (a.isDefault !== b.isDefault)
                return a.isDefault ? -1 : 1;
            return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
    }
    async list(userId) {
        return this.listByUser(userId);
    }
    async upsert(userId, dto) {
        const makeDefault = !!dto.isDefault;
        if (dto.id) {
            const existing = this.store.get(dto.id);
            if (!existing)
                throw new common_1.NotFoundException('address_not_found');
            if (existing.userId !== userId)
                throw new common_1.ForbiddenException('not_owner');
            const updated = {
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
            if (makeDefault)
                await this.setDefault(userId, updated.id);
            return updated;
        }
        const now = new Date();
        const created = {
            id: (0, crypto_1.randomUUID)(),
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
        if (makeDefault)
            await this.setDefault(userId, created.id);
        return created;
    }
    async setDefault(userId, addressId) {
        const addr = this.store.get(addressId);
        if (!addr)
            throw new common_1.NotFoundException('address_not_found');
        if (addr.userId !== userId)
            throw new common_1.ForbiddenException('not_owner');
        for (const item of this.store.values()) {
            if (item.userId !== userId)
                continue;
            this.store.set(item.id, {
                ...item,
                isDefault: item.id === addressId,
                updatedAt: new Date(),
            });
        }
        return { ok: true };
    }
    async remove(userId, addressId) {
        const addr = this.store.get(addressId);
        if (!addr)
            throw new common_1.NotFoundException('address_not_found');
        if (addr.userId !== userId)
            throw new common_1.ForbiddenException('not_owner');
        this.store.delete(addressId);
        return { ok: true };
    }
};
exports.AddressesService = AddressesService;
exports.AddressesService = AddressesService = __decorate([
    (0, common_1.Injectable)()
], AddressesService);
//# sourceMappingURL=addresses.service.js.map
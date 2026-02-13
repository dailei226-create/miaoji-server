"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const creators_service_1 = require("../creators/creators.service");
const crypto_1 = require("crypto");
let OrdersService = class OrdersService {
    constructor(prisma, creators) {
        this.prisma = prisma;
        this.creators = creators;
    }
    getEffectivePrice(work, activityDiscount) {
        const price = typeof work?.price === 'number' ? work.price : 0;
        const now = new Date();
        let workDiscountPrice = null;
        const discountPrice = typeof work?.discountPrice === 'number' ? work.discountPrice : null;
        const startAt = work?.discountStartAt ? new Date(work.discountStartAt) : null;
        const endAt = work?.discountEndAt ? new Date(work.discountEndAt) : null;
        if (discountPrice != null && startAt && endAt && now >= startAt && now <= endAt) {
            workDiscountPrice = discountPrice;
        }
        let activityPrice = null;
        if (activityDiscount != null && activityDiscount >= 1 && activityDiscount <= 100) {
            activityPrice = Math.round((price * activityDiscount) / 100);
        }
        const candidates = [price];
        if (workDiscountPrice != null)
            candidates.push(workDiscountPrice);
        if (activityPrice != null)
            candidates.push(activityPrice);
        return Math.min(...candidates);
    }
    async getActivityDiscount(workId) {
        try {
            const now = new Date();
            const activities = await this.prisma.activity.findMany({
                where: {
                    enabled: true,
                    AND: [
                        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
                        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
                    ],
                },
            });
            if (activities.length === 0)
                return null;
            const activityIds = activities.map((a) => a.id);
            const join = await this.prisma.activityJoin.findFirst({
                where: {
                    activityId: { in: activityIds },
                    workId,
                    leftAt: null,
                },
            });
            if (join) {
                return join.discount;
            }
        }
        catch (e) {
            console.error('[getActivityDiscount] error:', e);
        }
        return null;
    }
    sanitizeItems(items) {
        return (items || []).map((item) => {
            let cover = item.coverSnap || '';
            if (cover &&
                (cover.includes('http://tmp/') ||
                    cover.includes('/_tmp/') ||
                    cover.includes('/tmp/') ||
                    cover.includes('127.0.0.1:61120') ||
                    cover.startsWith('wxfile://'))) {
                cover = null;
            }
            return { ...item, coverSnap: cover };
        });
    }
    async create(userId, dto) {
        const workId = dto.workId;
        const qty = dto.qty ?? dto.quantity ?? dto.count ?? 1;
        const addressId = dto.addressId;
        const snapshotFromDto = dto.addressSnapshot;
        if (!workId || qty < 1) {
            throw new common_1.BadRequestException('参数错误');
        }
        if (!addressId) {
            throw new common_1.BadRequestException('请先添加收货地址');
        }
        const activityDiscount = await this.getActivityDiscount(workId);
        const workForSeller = await this.prisma.work.findUnique({ where: { id: workId } });
        if (!workForSeller)
            throw new common_1.NotFoundException('作品不存在');
        const sellerId = workForSeller.creatorId && String(workForSeller.creatorId) ? String(workForSeller.creatorId) : userId;
        if (sellerId !== userId) {
            const sellerCheck = await this.creators.checkSellerCanOperate(sellerId);
            if (!sellerCheck.ok) {
                throw new common_1.BadRequestException(sellerCheck.message || '卖家不可接单');
            }
        }
        return this.prisma.$transaction(async (tx) => {
            const work = await tx.work.findUnique({
                where: { id: workId },
            });
            if (!work)
                throw new common_1.NotFoundException('作品不存在');
            const stock = typeof work.stock === 'number' ? work.stock : 0;
            if (qty > stock)
                throw new common_1.BadRequestException('out_of_stock');
            const orderNo = `MO${Date.now()}${(0, crypto_1.randomBytes)(4).toString('hex')}`;
            const unitPrice = this.getEffectivePrice(work, activityDiscount);
            if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
                throw new common_1.BadRequestException('invalid_price');
            }
            const amount = Math.max(0, unitPrice) * qty;
            const addressSnapshot = snapshotFromDto && typeof snapshotFromDto === 'object' && (snapshotFromDto.name || snapshotFromDto.phone)
                ? { id: addressId, ...snapshotFromDto }
                : addressId
                    ? { id: addressId }
                    : {};
            const order = await tx.order.create({
                data: {
                    orderNo,
                    buyerId: userId,
                    sellerId,
                    status: 'created',
                    amount,
                    addressSnapshot,
                    items: {
                        create: [
                            {
                                workId: work.id,
                                titleSnap: work.title || work.id,
                                priceSnap: Math.max(0, unitPrice),
                                qty,
                                coverSnap: work.coverUrl || null,
                            },
                        ],
                    },
                },
                include: { items: true },
            });
            return {
                ...order,
                out_trade_no: order.orderNo,
            };
        });
    }
    async mockPay(userId, orderId) {
        if (!orderId)
            throw new common_1.BadRequestException('参数错误');
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.buyerId !== userId)
            throw new common_1.ForbiddenException('无权限');
        if (order.status === 'paid')
            return order;
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.order.update({
                where: { id: orderId },
                data: { status: 'paid' },
                include: { items: true },
            });
            for (const item of updated.items || []) {
                const qty = item.qty || 0;
                const res = await tx.work.updateMany({
                    where: { id: item.workId, stock: { gte: qty } },
                    data: { stock: { decrement: qty } },
                });
                if (!res || res.count === 0) {
                    throw new common_1.BadRequestException('out_of_stock');
                }
            }
            return {
                ...updated,
                items: this.sanitizeItems(updated.items),
                canPay: updated.status === 'created',
                payable: updated.status === 'created',
                totalAmount: updated.amount,
            };
        });
    }
    async cancel(userId, orderId) {
        if (!orderId)
            throw new common_1.BadRequestException('参数错误');
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.buyerId !== userId)
            throw new common_1.ForbiddenException('无权限');
        if (order.status !== 'created') {
            throw new common_1.BadRequestException('status_not_allowed');
        }
        return this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'canceled' },
        });
    }
    async listBuyer(userId) {
        const items = await this.prisma.order.findMany({
            where: { buyerId: userId },
            orderBy: { createdAt: 'desc' },
            include: { items: true },
        });
        return {
            items: items.map((order) => ({
                ...order,
                items: this.sanitizeItems(order.items),
                canPay: order.status === 'created',
                payable: order.status === 'created',
                totalAmount: order.amount,
            })),
        };
    }
    async listByUser(userId) {
        const items = await this.prisma.order.findMany({
            where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
            orderBy: { createdAt: 'desc' },
            include: { items: true },
        });
        return {
            items: items.map((order) => ({
                ...order,
                items: this.sanitizeItems(order.items),
                canPay: order.status === 'created',
                payable: order.status === 'created',
                totalAmount: order.amount,
            })),
        };
    }
    async listSeller(userId, status) {
        const allowed = new Set([client_1.OrderStatus.created, client_1.OrderStatus.paid, client_1.OrderStatus.canceled]);
        const st = status ? String(status) : '';
        const stEnum = allowed.has(st) ? st : undefined;
        const where = { sellerId: userId };
        if (stEnum)
            where.status = stEnum;
        const items = await this.prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { items: true },
        });
        return {
            items: items.map((order) => ({
                ...order,
                items: this.sanitizeItems(order.items),
                canPay: order.status === 'created',
                payable: order.status === 'created',
                totalAmount: order.amount,
            })),
        };
    }
    async detail(userId, id) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.buyerId !== userId && order.sellerId !== userId) {
            throw new common_1.ForbiddenException('无权限');
        }
        const canPay = order.status === 'created';
        return {
            ...order,
            items: this.sanitizeItems(order.items),
            canPay,
            payable: canPay,
            totalAmount: order.amount,
        };
    }
    async markShipped(userId, orderId, expressCompany, expressNo) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.sellerId !== userId) {
            throw new common_1.ForbiddenException('无权限操作此订单');
        }
        const sellerCheck = await this.creators.checkSellerCanOperate(userId);
        if (!sellerCheck.ok) {
            throw new common_1.BadRequestException(sellerCheck.message || '卖家不可发货');
        }
        if (order.status !== client_1.OrderStatus.paid) {
            throw new common_1.BadRequestException('订单状态不允许发货');
        }
        return this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: client_1.OrderStatus.shipped,
                expressCompany: expressCompany || null,
                expressNo: expressNo || null,
                shippedAt: new Date(),
            },
        });
    }
    async markAfterSale(orderId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        const snapshot = order.addressSnapshot || {};
        return this.prisma.order.update({
            where: { id: orderId },
            data: { addressSnapshot: { ...snapshot, mvpNote: 'after_sale' } },
        });
    }
    async adminList(query) {
        const { status, q, page = 1, pageSize = 20 } = query || {};
        const where = {};
        if (status && status !== 'all') {
            where.status = status;
        }
        if (q) {
            where.OR = [
                { orderNo: { contains: q } },
                { buyerId: { contains: q } },
            ];
        }
        const [items, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { items: true, refund: true, opLogs: { orderBy: { createdAt: 'desc' } } },
            }),
            this.prisma.order.count({ where }),
        ]);
        return { items, total, page, pageSize };
    }
    async adminDetail(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
                refund: true,
                opLogs: { orderBy: { createdAt: 'desc' } },
                buyer: { select: { id: true, nickname: true, openId: true } },
                seller: { select: { id: true, nickname: true, openId: true } },
            },
        });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        return order;
    }
    async writeOpLog(orderId, action, payload, adminId) {
        await this.prisma.orderOpLog.create({
            data: {
                orderId,
                action,
                payloadJson: payload || null,
                adminId: adminId || null,
            },
        });
    }
    async adminCancel(orderId, note, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.status !== 'created') {
            throw new common_1.BadRequestException('仅待付款订单可关闭');
        }
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'canceled' },
        });
        await this.writeOpLog(orderId, 'cancel', { note }, adminId);
        return updated;
    }
    async adminShip(orderId, data, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.status !== 'paid') {
            throw new common_1.BadRequestException('仅已付款订单可发货');
        }
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'shipped',
                expressCompany: data.expressCompany || null,
                expressNo: data.expressNo || null,
                shippedAt: new Date(),
            },
        });
        await this.writeOpLog(orderId, 'ship', data, adminId);
        return updated;
    }
    async adminComplete(orderId, note, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.status !== 'shipped') {
            throw new common_1.BadRequestException('仅已发货订单可完成');
        }
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'completed',
                completedAt: new Date(),
            },
        });
        await this.writeOpLog(orderId, 'complete', { note }, adminId);
        return updated;
    }
    async adminRefundRequest(orderId, data, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { refund: true } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (!['paid', 'shipped'].includes(order.status)) {
            throw new common_1.BadRequestException('仅已付款或已发货订单可申请退款');
        }
        if (order.refund) {
            throw new common_1.BadRequestException('已存在退款申请');
        }
        await this.prisma.$transaction([
            this.prisma.order.update({
                where: { id: orderId },
                data: { status: 'refund_requested' },
            }),
            this.prisma.orderRefund.create({
                data: {
                    orderId,
                    status: 'requested',
                    reason: data.reason || null,
                    requestNote: data.note || null,
                },
            }),
        ]);
        await this.writeOpLog(orderId, 'refund_request', data, adminId);
        return this.adminDetail(orderId);
    }
    async adminRefundApprove(orderId, note, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { refund: true } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.status !== 'refund_requested') {
            throw new common_1.BadRequestException('仅退款申请中的订单可同意');
        }
        await this.prisma.$transaction([
            this.prisma.order.update({
                where: { id: orderId },
                data: { status: 'refund_approved' },
            }),
            this.prisma.orderRefund.update({
                where: { orderId },
                data: {
                    status: 'approved',
                    decisionNote: note || null,
                    decidedAt: new Date(),
                },
            }),
        ]);
        await this.writeOpLog(orderId, 'refund_approve', { note }, adminId);
        return this.adminDetail(orderId);
    }
    async adminRefundReject(orderId, data, adminId) {
        if (!data.reason) {
            throw new common_1.BadRequestException('拒绝理由必填');
        }
        const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { refund: true } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.status !== 'refund_requested') {
            throw new common_1.BadRequestException('仅退款申请中的订单可拒绝');
        }
        await this.prisma.$transaction([
            this.prisma.order.update({
                where: { id: orderId },
                data: { status: 'refund_rejected' },
            }),
            this.prisma.orderRefund.update({
                where: { orderId },
                data: {
                    status: 'rejected',
                    decisionNote: `${data.reason}${data.note ? '\n' + data.note : ''}`,
                    decidedAt: new Date(),
                },
            }),
        ]);
        await this.writeOpLog(orderId, 'refund_reject', data, adminId);
        return this.adminDetail(orderId);
    }
    async adminRefundExecute(orderId) {
        throw new common_1.ForbiddenException('退款未开启（部署后接微信退款）');
    }
    async adminUpdateNote(orderId, note, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { adminNote: note },
        });
        await this.writeOpLog(orderId, 'note', { note }, adminId);
        return updated;
    }
    async confirmReceipt(userId, orderId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.buyerId !== userId)
            throw new common_1.BadRequestException('无权操作此订单');
        if (order.status !== 'shipped') {
            throw new common_1.BadRequestException('仅已发货订单可确认收货');
        }
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'received',
                receivedAt: new Date(),
            },
        });
        await this.writeOpLog(orderId, 'confirm_receipt', {}, userId);
        return { ok: true, status: updated.status };
    }
    async requestRefund(userId, orderId, reason, type) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.buyerId !== userId)
            throw new common_1.BadRequestException('无权操作此订单');
        const refundType = type || 'refund';
        if (refundType === 'refund') {
            if (order.status !== 'paid' && order.status !== 'paid_mock') {
                throw new common_1.BadRequestException('仅已付款且未发货订单可申请退款');
            }
        }
        else {
            if (order.status !== 'shipped') {
                throw new common_1.BadRequestException('仅已发货订单可申请退货退款');
            }
        }
        const existingRefund = await this.prisma.orderRefund.findUnique({ where: { orderId } });
        if (existingRefund && existingRefund.status !== 'rejected') {
            throw new common_1.BadRequestException('已有退款申请，请勿重复提交');
        }
        if (existingRefund) {
            await this.prisma.orderRefund.update({
                where: { orderId },
                data: {
                    status: 'pending',
                    reason: reason || null,
                    requestNote: refundType,
                    decidedAt: null,
                    decisionNote: null,
                },
            });
        }
        else {
            await this.prisma.orderRefund.create({
                data: {
                    orderId,
                    status: 'pending',
                    reason: reason || null,
                    requestNote: refundType,
                },
            });
        }
        await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'refund_requested' },
        });
        await this.writeOpLog(orderId, 'refund_request_buyer', { reason, type: refundType }, userId);
        return { ok: true, status: 'refund_requested' };
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        creators_service_1.CreatorsService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map
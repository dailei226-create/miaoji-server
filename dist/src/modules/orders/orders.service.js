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
const display_no_1 = require("../../utils/display-no");
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
    getAfterSaleSellerDecision(opLogs) {
        if (!opLogs || !Array.isArray(opLogs))
            return null;
        const logs = opLogs.filter((l) => l.action === 'after_sale_seller_decision');
        if (logs.length === 0)
            return null;
        const latest = logs.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
        const p = latest.payloadJson;
        if (!p)
            return null;
        return {
            decision: p.decision || null,
            reason: p.reason ?? null,
            returnAddress: p.returnAddress ?? null,
            decidedAt: p.decidedAt ?? null,
            opCreatedAt: latest.createdAt ? new Date(latest.createdAt).toISOString() : null,
        };
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
    mapOrderShape(order) {
        const refundNo = order?.refund?.displayNo || order?.refund?.refundNo || order?.refund?.no || order?.refund?.id || null;
        const requestNote = String(order?.refund?.requestNote || '').toLowerCase();
        const refundType = requestNote === 'return_refund' ? 'RETURN_REFUND' : 'ONLY_REFUND';
        const refund = order?.refund
            ? {
                ...order.refund,
                displayNo: order.refund.displayNo || refundNo || null,
                type: order.refund.type || refundType,
                refundNo,
                afterSaleNo: refundNo,
                aftersaleNo: refundNo,
            }
            : order?.refund;
        return {
            ...order,
            displayNo: order?.displayNo || null,
            orderDisplayNo: order?.displayNo || order?.orderNo || null,
            refundDisplayNo: refundNo,
            afterSaleDisplayNo: refundNo,
            refund,
            afterSaleNo: refundNo,
            aftersaleNo: refundNo,
        };
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
        const displayNo = await (0, display_no_1.createUniqueOrderDisplayNo)(this.prisma);
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
                    displayNo,
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
        console.log('[listBuyer] userId =', userId);
        const items = await this.prisma.order.findMany({
            where: { buyerId: userId },
            orderBy: { createdAt: 'desc' },
            include: { items: true, refund: true },
        });
        console.log('[listBuyer] found', items.length, 'orders');
        const orderIds = items.map((x) => x.id);
        const applyCountMap = {};
        if (orderIds.length > 0) {
            const groups = await this.prisma.orderOpLog.groupBy({
                by: ['orderId'],
                where: { orderId: { in: orderIds }, action: 'refund_request_buyer' },
                _count: { _all: true },
            });
            for (const g of groups) {
                applyCountMap[g.orderId] = g._count._all;
            }
        }
        return {
            items: items.map((order) => ({
                ...this.mapOrderShape(order),
                items: this.sanitizeItems(order.items),
                canPay: order.status === 'created',
                payable: order.status === 'created',
                totalAmount: order.amount,
                refundApplyCount: applyCountMap[order.id] || 0,
            })),
        };
    }
    async listByUser(userId) {
        const items = await this.prisma.order.findMany({
            where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
            orderBy: { createdAt: 'desc' },
            include: { items: true, refund: true },
        });
        return {
            items: items.map((order) => ({
                ...this.mapOrderShape(order),
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
            include: { items: true, refund: true, opLogs: { orderBy: { createdAt: 'desc' } } },
        });
        return {
            items: items.map((order) => {
                const afterSaleSellerDecision = this.getAfterSaleSellerDecision(order.opLogs);
                return {
                    ...this.mapOrderShape(order),
                    items: this.sanitizeItems(order.items),
                    canPay: order.status === 'created',
                    payable: order.status === 'created',
                    totalAmount: order.amount,
                    afterSaleSellerDecision,
                };
            }),
        };
    }
    async detail(userId, id) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: { items: true, refund: true, opLogs: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
        });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.buyerId !== userId && order.sellerId !== userId) {
            throw new common_1.ForbiddenException('无权限');
        }
        const canPay = order.status === 'created';
        const afterSaleSellerDecision = this.getAfterSaleSellerDecision(order.opLogs);
        return {
            ...this.mapOrderShape(order),
            items: this.sanitizeItems(order.items),
            canPay,
            payable: canPay,
            totalAmount: order.amount,
            afterSaleSellerDecision,
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
        const qTrim = String(q || '').trim();
        if (qTrim) {
            const isNumericDisplayNo = /^\d{10,}$/.test(qTrim);
            if (isNumericDisplayNo) {
                where.OR = [
                    { displayNo: qTrim },
                    { refund: { is: { displayNo: qTrim } } },
                    { buyer: { is: { displayNo: qTrim } } },
                    { orderNo: { contains: qTrim } },
                    { id: { contains: qTrim } },
                    { buyerId: { contains: qTrim } },
                ];
            }
            else {
                where.OR = [
                    { orderNo: { contains: qTrim } },
                    { id: { contains: qTrim } },
                    { buyerId: { contains: qTrim } },
                    { displayNo: { contains: qTrim } },
                ];
            }
        }
        const [rows, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { items: true, refund: true, opLogs: { orderBy: { createdAt: 'desc' } } },
            }),
            this.prisma.order.count({ where }),
        ]);
        const items = rows.map((order) => ({
            ...this.mapOrderShape(order),
            afterSaleSellerDecision: this.getAfterSaleSellerDecision(order.opLogs),
        }));
        return { items, total, page, pageSize };
    }
    async adminDetail(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
                refund: true,
                opLogs: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
                buyer: { select: { id: true, displayNo: true, nickname: true, openId: true } },
                seller: { select: { id: true, displayNo: true, nickname: true, openId: true } },
            },
        });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        return {
            ...this.mapOrderShape(order),
            afterSaleSellerDecision: this.getAfterSaleSellerDecision(order.opLogs),
        };
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
        if (order.status !== 'received') {
            throw new common_1.BadRequestException('仅已收货订单可完成');
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
        const forcedRefundType = order.shippedAt ? 'return_refund' : 'refund';
        await this.prisma.$transaction([
            this.prisma.order.update({
                where: { id: orderId },
                data: { status: 'refund_requested' },
            }),
            this.prisma.orderRefund.create({
                data: {
                    displayNo: await (0, display_no_1.createUniqueRefundDisplayNo)(this.prisma),
                    orderId,
                    status: 'requested',
                    reason: data.reason || null,
                    requestNote: forcedRefundType,
                },
            }),
        ]);
        await this.writeOpLog(orderId, 'refund_request', { ...data, type: forcedRefundType }, adminId);
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
        if (order.status === 'received' || order.status === 'completed') {
            return { ok: true, status: order.status };
        }
        if (order.status !== 'shipped') {
            throw new common_1.BadRequestException('订单状态不允许确认收货');
        }
        const now = new Date();
        const updated = await this.prisma.$transaction(async (tx) => {
            const step1 = await tx.order.updateMany({
                where: { id: orderId, status: 'shipped' },
                data: { status: 'received', receivedAt: now },
            });
            if (step1.count === 0) {
                const latest = await tx.order.findUnique({ where: { id: orderId } });
                if (!latest)
                    throw new common_1.NotFoundException('订单不存在');
                if (latest && (latest.status === 'received' || latest.status === 'completed')) {
                    return latest;
                }
                throw new common_1.BadRequestException('订单状态不允许确认收货');
            }
            await tx.order.updateMany({
                where: { id: orderId, status: 'received' },
                data: { status: 'completed', completedAt: now },
            });
            const latest = await tx.order.findUnique({ where: { id: orderId } });
            if (!latest)
                throw new common_1.NotFoundException('订单不存在');
            return latest;
        });
        await this.writeOpLog(orderId, 'confirm_receipt', {}, userId);
        return { ok: true, status: updated.status };
    }
    async requestRefund(userId, orderId, reason, type, action) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.buyerId !== userId)
            throw new common_1.BadRequestException('无权操作此订单');
        const opAction = (action || '');
        if (opAction && opAction !== 'modify') {
            throw new common_1.BadRequestException('invalid_action');
        }
        const existingRefund = await this.prisma.orderRefund.findUnique({ where: { orderId } });
        if (order.status === 'refund_requested' && !opAction) {
            throw new common_1.BadRequestException('已提交申请，如需修改请使用 modify');
        }
        const refundType = (order.shippedAt ? 'return_refund' : 'refund');
        if (opAction === 'modify') {
            if (!existingRefund)
                throw new common_1.BadRequestException('退款申请不存在');
            if (order.status !== 'refund_requested' || existingRefund.status !== 'requested') {
                throw new common_1.BadRequestException('当前状态不可修改退款申请');
            }
            await this.prisma.orderRefund.update({
                where: { orderId },
                data: {
                    reason: reason || null,
                    requestNote: refundType,
                },
            });
            await this.writeOpLog(orderId, 'refund_modify_buyer', { reason, type: refundType }, userId);
            return { ok: true, status: 'refund_requested' };
        }
        const allowedApplyStatuses = new Set(['paid', 'paid_mock', 'shipped']);
        if (order.status !== 'refund_rejected' && !allowedApplyStatuses.has(String(order.status))) {
            throw new common_1.BadRequestException('订单状态不允许申请退款');
        }
        const applyCount = await this.prisma.orderOpLog.count({
            where: { orderId, action: 'refund_request_buyer' },
        });
        if (applyCount >= 2 && order.status === 'refund_rejected') {
            throw new common_1.BadRequestException('退款申请次数已达上限');
        }
        if (applyCount >= 2 && existingRefund && existingRefund.status === 'rejected') {
            throw new common_1.BadRequestException('退款申请次数已达上限');
        }
        if (existingRefund) {
            await this.prisma.orderRefund.update({
                where: { orderId },
                data: {
                    status: 'requested',
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
                    displayNo: await (0, display_no_1.createUniqueRefundDisplayNo)(this.prisma),
                    orderId,
                    status: 'requested',
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
    async cancelRefund(userId, orderId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.buyerId !== userId)
            throw new common_1.BadRequestException('无权操作此订单');
        if (order.status !== 'refund_requested') {
            throw new common_1.BadRequestException('仅退款申请中的订单可取消申请');
        }
        const existingRefund = await this.prisma.orderRefund.findUnique({ where: { orderId } });
        if (!existingRefund) {
            const restoreStatus = order.shippedAt ? 'shipped' : 'paid';
            await this.prisma.$transaction([
                this.prisma.order.update({ where: { id: orderId }, data: { status: restoreStatus } }),
                this.prisma.orderOpLog.create({ data: { orderId, action: 'refund_cancel_buyer', adminId: userId } }),
            ]);
            return { ok: true, status: restoreStatus };
        }
        if (existingRefund.status !== 'requested') {
            throw new common_1.BadRequestException('当前状态不可取消退款申请');
        }
        const restoreStatus = order.shippedAt ? 'shipped' : 'paid';
        await this.prisma.$transaction([
            this.prisma.orderRefund.delete({ where: { orderId } }),
            this.prisma.order.update({ where: { id: orderId }, data: { status: restoreStatus } }),
            this.prisma.orderOpLog.create({ data: { orderId, action: 'refund_cancel_buyer', adminId: userId } }),
        ]);
        return { ok: true, status: restoreStatus };
    }
    async afterSaleSellerDecision(userId, orderId, body) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { refund: true },
        });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        if (order.sellerId !== userId) {
            throw new common_1.ForbiddenException('无权限操作此订单');
        }
        if (order.status !== 'refund_requested') {
            throw new common_1.BadRequestException('仅退款申请中的订单可提交处理意见');
        }
        if (!order.refund || order.refund.status !== 'requested') {
            throw new common_1.BadRequestException('当前状态不可提交处理意见');
        }
        const decision = body.decision;
        const allowed = ['agree_return', 'agree_refund', 'reject'];
        if (!decision || !allowed.includes(decision)) {
            throw new common_1.BadRequestException('无效的 decision');
        }
        if (decision === 'reject' && !String(body.reason || '').trim()) {
            throw new common_1.BadRequestException('拒绝时请填写原因');
        }
        const payload = {
            decision,
            reason: body.reason?.trim() || null,
            returnAddress: body.returnAddress || null,
            decidedAt: new Date().toISOString(),
        };
        await this.prisma.orderOpLog.create({
            data: {
                orderId,
                action: 'after_sale_seller_decision',
                payloadJson: payload,
                adminId: null,
            },
        });
        return { ok: true };
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        creators_service_1.CreatorsService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map
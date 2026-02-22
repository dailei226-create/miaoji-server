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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pay_service_1 = require("./pay.service");
const create_prepay_dto_1 = require("./dto/create-prepay.dto");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto = require("crypto");
const fs = require("fs");
let PayController = class PayController {
    constructor(payService, config, prisma) {
        this.payService = payService;
        this.config = config;
        this.prisma = prisma;
    }
    async prepay(dto) {
        const order = await this.prisma.order.findUnique({
            where: { id: dto.orderId },
        });
        if (!order)
            throw new common_1.NotFoundException('order_not_found');
        return this.payService.prepay({
            code: dto.code,
            amount: dto.amount,
            description: dto.description,
            outTradeNo: order.orderNo,
        });
    }
    async notify(req, res) {
        try {
            const rawBody = req.rawBody || JSON.stringify(req.body || {});
            const timestamp = String(req.header('Wechatpay-Timestamp') || '');
            const nonce = String(req.header('Wechatpay-Nonce') || '');
            const signature = String(req.header('Wechatpay-Signature') || '');
            const serial = String(req.header('Wechatpay-Serial') || '');
            const platformCertPath = this.config.get('WXPAY_PLATFORM_CERT_PATH') ||
                this.config.get('WXPAY_PLATFORM_CERT') ||
                '';
            if (!platformCertPath || !fs.existsSync(platformCertPath)) {
                console.error('[pay/notify] missing platform cert path:', platformCertPath);
                return res.status(500).json({ code: 'FAIL', message: 'missing platform cert' });
            }
            const platformCertPem = fs.readFileSync(platformCertPath, 'utf8');
            const platformPublicKey = crypto.createPublicKey(platformCertPem);
            const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
            const verified = crypto.verify('RSA-SHA256', Buffer.from(message, 'utf8'), platformPublicKey, Buffer.from(signature, 'base64'));
            if (!verified) {
                console.error('[pay/notify] signature verify FAIL', { serial, timestamp, nonce });
                return res.status(401).json({ code: 'FAIL', message: 'signature verify fail' });
            }
            const apiV3Key = this.config.get('WXPAY_API_V3_KEY') || '';
            if (!apiV3Key || apiV3Key.length !== 32) {
                console.error('[pay/notify] invalid api v3 key length');
                return res.status(500).json({ code: 'FAIL', message: 'invalid api v3 key' });
            }
            const body = req.body;
            const resource = body?.resource;
            if (!resource?.ciphertext || !resource?.nonce) {
                console.error('[pay/notify] missing resource fields', body);
                return res.status(400).json({ code: 'FAIL', message: 'bad notify body' });
            }
            const decrypted = this.decryptResource({
                apiV3Key,
                ciphertext: resource.ciphertext,
                nonce: resource.nonce,
                associated_data: resource.associated_data || '',
            });
            const payResult = JSON.parse(decrypted);
            console.log('[pay/notify] VERIFIED & DECRYPTED OK:', {
                event_type: body?.event_type,
                resource_type: body?.resource_type,
                out_trade_no: payResult?.out_trade_no,
                transaction_id: payResult?.transaction_id,
                trade_state: payResult?.trade_state,
                amount: payResult?.amount,
            });
            const outTradeNo = payResult?.out_trade_no ? String(payResult.out_trade_no) : '';
            const tradeState = payResult?.trade_state ? String(payResult.trade_state) : '';
            const wxAmountTotal = payResult?.amount?.total;
            if (!outTradeNo) {
                console.error('[pay/notify] missing out_trade_no');
                return res.status(200).json({ code: 'SUCCESS', message: '成功' });
            }
            if (tradeState !== 'SUCCESS') {
                console.log('[pay/notify] trade_state not SUCCESS, skip update:', { outTradeNo, tradeState });
                return res.status(200).json({ code: 'SUCCESS', message: '成功' });
            }
            const order = await this.prisma.order.findFirst({ where: { orderNo: outTradeNo } });
            if (!order) {
                console.error('[pay/notify] order not found for out_trade_no:', outTradeNo);
                return res.status(200).json({ code: 'SUCCESS', message: '成功' });
            }
            const alreadyHandledStatuses = new Set([
                'paid',
                'paid_mock',
                'shipped',
                'received',
                'completed',
                'refund_requested',
                'refund_approved',
                'refund_rejected',
                'refunded',
            ]);
            if (alreadyHandledStatuses.has(String(order.status))) {
                console.log('[pay/notify] already handled, skip update:', {
                    orderId: order.id,
                    orderNo: order.orderNo,
                    status: order.status,
                });
                return res.status(200).json({ code: 'SUCCESS', message: '成功' });
            }
            const wxTotalFen = Number(wxAmountTotal);
            const dbTotalFen = Number(order.amount);
            if (!Number.isFinite(wxTotalFen) || wxTotalFen <= 0) {
                console.error('[pay/notify] invalid wx amount.total, skip update:', { outTradeNo, wxAmountTotal });
                return res.status(200).json({ code: 'SUCCESS', message: '成功' });
            }
            if (!Number.isFinite(dbTotalFen) || dbTotalFen <= 0) {
                console.error('[pay/notify] invalid db order.amount, skip update:', { orderId: order.id, dbTotalFen });
                return res.status(200).json({ code: 'SUCCESS', message: '成功' });
            }
            if (wxTotalFen !== dbTotalFen) {
                console.error('[pay/notify] amount mismatch, skip update:', {
                    orderId: order.id,
                    orderNo: order.orderNo,
                    dbTotalFen,
                    wxTotalFen,
                    transaction_id: payResult?.transaction_id,
                });
                return res.status(200).json({ code: 'SUCCESS', message: '成功' });
            }
            const data = { status: 'paid', paidAt: new Date() };
            if (payResult?.transaction_id)
                data.transactionId = String(payResult.transaction_id);
            const upd = await this.prisma.order.updateMany({
                where: { id: order.id, status: 'created' },
                data,
            });
            if (upd.count !== 1) {
                console.log('[pay/notify] updateMany count!=1 (probably concurrent), skip:', {
                    orderId: order.id,
                    status: order.status,
                    count: upd.count,
                });
            }
            return res.status(200).json({ code: 'SUCCESS', message: '成功' });
        }
        catch (e) {
            console.error('[pay/notify] exception:', e?.message || e);
            return res.status(500).json({ code: 'FAIL', message: 'server error' });
        }
    }
    decryptResource(params) {
        const { apiV3Key, ciphertext, nonce, associated_data } = params;
        const ct = Buffer.from(ciphertext, 'base64');
        const authTag = ct.subarray(ct.length - 16);
        const data = ct.subarray(0, ct.length - 16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(nonce, 'utf8'));
        decipher.setAuthTag(authTag);
        if (associated_data) {
            decipher.setAAD(Buffer.from(associated_data, 'utf8'));
        }
        const decoded = Buffer.concat([decipher.update(data), decipher.final()]);
        return decoded.toString('utf8');
    }
};
exports.PayController = PayController;
__decorate([
    (0, common_1.Post)('prepay'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_prepay_dto_1.CreatePrepayDto]),
    __metadata("design:returntype", Promise)
], PayController.prototype, "prepay", null);
__decorate([
    (0, common_1.Post)('notify'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PayController.prototype, "notify", null);
exports.PayController = PayController = __decorate([
    (0, common_1.Controller)('pay'),
    __metadata("design:paramtypes", [pay_service_1.PayService,
        config_1.ConfigService,
        prisma_service_1.PrismaService])
], PayController);
//# sourceMappingURL=pay.controller.js.map
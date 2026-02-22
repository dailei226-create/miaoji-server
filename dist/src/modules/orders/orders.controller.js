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
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const orders_service_1 = require("./orders.service");
const dto_1 = require("./dto");
const isDev = process.env.NODE_ENV !== 'production';
let OrdersController = class OrdersController {
    constructor(orders) {
        this.orders = orders;
    }
    async create(req, dto) {
        const userId = req.user?.sub;
        return this.orders.create(userId, dto);
    }
    async mockPay(req, dto) {
        if (!isDev) {
            throw new common_1.ForbiddenException('mock-pay is only available in development environment');
        }
        const userId = req.user?.sub;
        return this.orders.mockPay(userId, dto.orderId);
    }
    async mockPayById(req, id) {
        if (!isDev) {
            throw new common_1.ForbiddenException('mock-pay is only available in development environment');
        }
        const userId = req.user?.sub;
        return this.orders.mockPay(userId, id);
    }
    async cancel(req, id) {
        const userId = req.user?.sub;
        return this.orders.cancel(userId, id);
    }
    async list(req) {
        const userId = req.user?.sub;
        return this.orders.listBuyer(userId);
    }
    async myBuyerOrders(req) {
        const userId = req.user?.sub;
        return this.orders.listBuyer(userId);
    }
    async listByUser(userId) {
        return this.orders.listByUser(userId);
    }
    async markShipped(req, id, body) {
        const userId = req.user?.sub;
        return this.orders.markShipped(userId, id, body.expressCompany, body.expressNo);
    }
    async markAfterSale(id) {
        return this.orders.markAfterSale(id);
    }
    async confirmReceipt(req, id) {
        const userId = req.user?.sub;
        return this.orders.confirmReceipt(userId, id);
    }
    async requestRefund(req, id, body) {
        const userId = req.user?.sub;
        return this.orders.requestRefund(userId, id, body.reason, body.type, body.action);
    }
    async cancelRefund(req, id) {
        const userId = req.user?.sub;
        return this.orders.cancelRefund(userId, id);
    }
    async afterSaleDecision(req, id, body) {
        const userId = req.user?.sub;
        return this.orders.afterSaleSellerDecision(userId, id, body);
    }
    async mySellerOrders(req, status) {
        const userId = req.user?.sub;
        return this.orders.listSeller(userId, status);
    }
    async detail(req, id) {
        const userId = req.user?.sub;
        return this.orders.detail(userId, id);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CreateOrderDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('mock-pay'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.MockPayDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "mockPay", null);
__decorate([
    (0, common_1.Post)(':id/mock-pay'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "mockPayById", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "myBuyerOrders", null);
__decorate([
    (0, common_1.Get)('user/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "listByUser", null);
__decorate([
    (0, common_1.Post)(':id/ship'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "markShipped", null);
__decorate([
    (0, common_1.Post)(':id/after-sale'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "markAfterSale", null);
__decorate([
    (0, common_1.Post)(':id/confirm-receipt'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "confirmReceipt", null);
__decorate([
    (0, common_1.Post)(':id/request-refund'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "requestRefund", null);
__decorate([
    (0, common_1.Post)(':id/cancel-refund'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "cancelRefund", null);
__decorate([
    (0, common_1.Post)(':id/after-sale/decision'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "afterSaleDecision", null);
__decorate([
    (0, common_1.Get)('seller'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "mySellerOrders", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "detail", null);
exports.OrdersController = OrdersController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map
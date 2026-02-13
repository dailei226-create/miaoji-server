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
exports.AdminOrdersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const orders_service_1 = require("./orders.service");
let AdminOrdersController = class AdminOrdersController {
    constructor(orders) {
        this.orders = orders;
    }
    async list(status, q, page, pageSize) {
        return this.orders.adminList({
            status,
            q,
            page: page ? parseInt(page, 10) : 1,
            pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        });
    }
    async detail(id) {
        return this.orders.adminDetail(id);
    }
    async cancel(id, body, req) {
        const adminId = req.user?.userId || req.user?.id;
        return this.orders.adminCancel(id, body.note, adminId);
    }
    async ship(id, body, req) {
        const adminId = req.user?.userId || req.user?.id;
        return this.orders.adminShip(id, body, adminId);
    }
    async complete(id, body, req) {
        const adminId = req.user?.userId || req.user?.id;
        return this.orders.adminComplete(id, body.note, adminId);
    }
    async refundRequest(id, body, req) {
        const adminId = req.user?.userId || req.user?.id;
        return this.orders.adminRefundRequest(id, body, adminId);
    }
    async refundApprove(id, body, req) {
        const adminId = req.user?.userId || req.user?.id;
        return this.orders.adminRefundApprove(id, body.note, adminId);
    }
    async refundReject(id, body, req) {
        const adminId = req.user?.userId || req.user?.id;
        return this.orders.adminRefundReject(id, body, adminId);
    }
    async refundExecute(id) {
        return this.orders.adminRefundExecute(id);
    }
    async updateNote(id, body, req) {
        const adminId = req.user?.userId || req.user?.id;
        return this.orders.adminUpdateNote(id, body.note, adminId);
    }
};
exports.AdminOrdersController = AdminOrdersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/ship'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "ship", null);
__decorate([
    (0, common_1.Post)(':id/complete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "complete", null);
__decorate([
    (0, common_1.Post)(':id/refund/request'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "refundRequest", null);
__decorate([
    (0, common_1.Post)(':id/refund/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "refundApprove", null);
__decorate([
    (0, common_1.Post)(':id/refund/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "refundReject", null);
__decorate([
    (0, common_1.Post)(':id/refund/execute'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "refundExecute", null);
__decorate([
    (0, common_1.Post)(':id/note'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "updateNote", null);
exports.AdminOrdersController = AdminOrdersController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Controller)('admin/orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], AdminOrdersController);
//# sourceMappingURL=orders.admin.controller.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModule = void 0;
const common_1 = require("@nestjs/common");
const creators_module_1 = require("../creators/creators.module");
const orders_service_1 = require("./orders.service");
const orders_controller_1 = require("./orders.controller");
const orders_admin_controller_1 = require("./orders.admin.controller");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [creators_module_1.CreatorsModule],
        providers: [orders_service_1.OrdersService],
        controllers: [orders_controller_1.OrdersController, orders_admin_controller_1.AdminOrdersController],
    })
], OrdersModule);
//# sourceMappingURL=orders.module.js.map
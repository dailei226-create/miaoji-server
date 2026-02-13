"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorksModule = void 0;
const common_1 = require("@nestjs/common");
const config_module_1 = require("../config/config.module");
const works_service_1 = require("./works.service");
const works_controller_1 = require("./works.controller");
const works_admin_controller_1 = require("./works.admin.controller");
let WorksModule = class WorksModule {
};
exports.WorksModule = WorksModule;
exports.WorksModule = WorksModule = __decorate([
    (0, common_1.Module)({
        imports: [config_module_1.ConfigModule],
        providers: [works_service_1.WorksService],
        controllers: [works_controller_1.WorksController, works_admin_controller_1.AdminWorksController],
    })
], WorksModule);
//# sourceMappingURL=works.module.js.map
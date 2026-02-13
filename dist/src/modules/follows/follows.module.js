"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowsModule = void 0;
const common_1 = require("@nestjs/common");
const follows_controller_1 = require("./follows.controller");
const follows_service_1 = require("./follows.service");
let FollowsModule = class FollowsModule {
};
exports.FollowsModule = FollowsModule;
exports.FollowsModule = FollowsModule = __decorate([
    (0, common_1.Module)({
        controllers: [follows_controller_1.FollowsController],
        providers: [follows_service_1.FollowsService],
    })
], FollowsModule);
//# sourceMappingURL=follows.module.js.map
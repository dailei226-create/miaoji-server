"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("./modules/prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const works_module_1 = require("./modules/works/works.module");
const addresses_module_1 = require("./modules/addresses/addresses.module");
const orders_module_1 = require("./modules/orders/orders.module");
const pay_module_1 = require("./modules/pay/pay.module");
const favorites_module_1 = require("./modules/favorites/favorites.module");
const follows_module_1 = require("./modules/follows/follows.module");
const banners_module_1 = require("./modules/banners/banners.module");
const activities_module_1 = require("./modules/activities/activities.module");
const categories_module_1 = require("./modules/categories/categories.module");
const config_module_1 = require("./modules/config/config.module");
const creators_module_1 = require("./modules/creators/creators.module");
const upload_module_1 = require("./modules/upload/upload.module");
const support_module_1 = require("./modules/support/support.module");
const creator_agreement_module_1 = require("./modules/creator-agreement/creator-agreement.module");
const sms_module_1 = require("./modules/sms/sms.module");
const health_controller_1 = require("./health.controller");
const time_controller_1 = require("./time.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            upload_module_1.UploadModule,
            works_module_1.WorksModule,
            addresses_module_1.AddressesModule,
            orders_module_1.OrdersModule,
            pay_module_1.PayModule,
            favorites_module_1.FavoritesModule,
            follows_module_1.FollowsModule,
            creators_module_1.CreatorsModule,
            banners_module_1.BannersModule,
            activities_module_1.ActivitiesModule,
            categories_module_1.CategoriesModule,
            config_module_1.ConfigModule,
            support_module_1.SupportModule,
            creator_agreement_module_1.CreatorAgreementModule,
            sms_module_1.SmsModule,
        ],
        controllers: [health_controller_1.HealthController, time_controller_1.TimeController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
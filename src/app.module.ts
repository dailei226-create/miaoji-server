import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorksModule } from './modules/works/works.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PayModule } from './modules/pay/pay.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { FollowsModule } from './modules/follows/follows.module';
import { BannersModule } from './modules/banners/banners.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ConfigModule } from './modules/config/config.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { UploadModule } from './modules/upload/upload.module';
import { SupportModule } from './modules/support/support.module';
import { CreatorAgreementModule } from './modules/creator-agreement/creator-agreement.module';
import { HealthController } from './health.controller';
import { TimeController } from './time.controller';

@Module({
  imports: [
    NestConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    PrismaModule,
    AuthModule,
    UploadModule,
    WorksModule,
    AddressesModule,
    OrdersModule,
    PayModule,
    FavoritesModule,
    FollowsModule,
    CreatorsModule,
    BannersModule,
    ActivitiesModule,
    CategoriesModule,
    ConfigModule,
    SupportModule,
    CreatorAgreementModule,
  ],
  controllers: [HealthController, TimeController],
})
export class AppModule {}

// MVP一期冻结说明：核心模块=Auth/Orders/Pay；非核心暂不扩展=Works/Addresses（仅维持当前可用）

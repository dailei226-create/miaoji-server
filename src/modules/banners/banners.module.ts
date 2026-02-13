import { Module } from '@nestjs/common';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';
import { AdminBannersController } from './banners.admin.controller';

@Module({
  controllers: [BannersController, AdminBannersController],
  providers: [BannersService],
})
export class BannersModule {}

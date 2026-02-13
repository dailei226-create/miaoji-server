import { Controller, Get, Query } from '@nestjs/common';
import { BannersService } from './banners.service';
import { BannerPosition } from './dto';

@Controller('banners')
export class BannersController {
  constructor(private banners: BannersService) {}

  @Get()
  async listPublic(@Query('position') position?: BannerPosition) {
    return this.banners.listPublic(position);
  }
}

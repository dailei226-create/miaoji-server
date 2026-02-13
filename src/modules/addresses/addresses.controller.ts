import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';
import { UpsertAddressDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private addrs: AddressesService) {}

  @Get()
  async list(@Req() req: Request) {
    // @ts-expect-error injected by passport
    const userId = req.user?.sub as string;
    return this.addrs.list(userId);
  }

  @Post()
  async upsert(@Req() req: Request, @Body() dto: UpsertAddressDto) {
    // @ts-expect-error injected by passport
    const userId = req.user?.sub as string;
    return this.addrs.upsert(userId, dto);
  }

  @Post(':id/default')
  async setDefault(@Req() req: Request, @Param('id') id: string) {
    // @ts-expect-error injected by passport
    const userId = req.user?.sub as string;
    return this.addrs.setDefault(userId, id);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    // @ts-expect-error injected by passport
    const userId = req.user?.sub as string;
    return this.addrs.remove(userId, id);
  }
}

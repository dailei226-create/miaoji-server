import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { WorksService } from './works.service';
import { SetCreatorDiscountDto, SetCreatorPriceDto, UpsertWorkDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';

@Controller('works')
export class WorksController {
  constructor(private works: WorksService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('keyword') keyword?: string,
    @Query('categoryId') categoryId?: string,
    @Query('creatorId') creatorId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('discount') discount?: string,
    @Query('activityCatId') activityCatId?: string,
    @Query('activitySubId') activitySubId?: string,
    @Query('activityOnly') activityOnly?: string,
  ) {
    const query = q || keyword;
    return this.works.listPublic({
      q: query,
      categoryId,
      creatorId: creatorId || undefined,
      page: Number(page),
      pageSize: Number(pageSize),
      discount: discount === '1' ? 1 : undefined,
      activityCatId: activityCatId || undefined,
      activitySubId: activitySubId || undefined,
      activityOnly: activityOnly === '1' ? 1 : undefined,
    });
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.works.getPublic(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me/list')
  async myList(@Req() req: Request, @Query('status') status?: string) {
    const user = (req as any).user;
    const userId = user?.sub as string;
    return this.works.listMine({ userId, status, user });
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me/:id')
  async myDetail(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.sub as string;
    return this.works.getMine(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/me/draft')
  async upsertDraft(@Req() req: Request, @Body() dto: UpsertWorkDto) {
    console.log('[PROOF][server recv]', (dto as any).price, (dto as any).priceCent, dto);
    const userId = (req.user as any)?.id || (req.user as any)?.userId || (req.user as any)?.openid || (req.user as any)?.sub;
    if (!userId) throw new UnauthorizedException('unauthorized');
    return this.works.upsertDraft(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/me/:id/submit')
  async submit(@Req() req: Request, @Param('id') id: string) {
    // @ts-expect-error injected by passport
    const userId = req.user?.sub as string;
    return this.works.submitReview(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/me/:id')
  async del(@Req() req: Request, @Param('id') id: string) {
    // @ts-expect-error injected by passport
    const userId = req.user?.sub as string;
    return this.works.deleteMine(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/me/:id/discount')
  async setMyDiscount(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SetCreatorDiscountDto,
  ) {
    const userId = (req as any).user?.sub as string;
    return this.works.setDiscountByCreator(id, userId, dto.discountPercent);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/me/:id/price')
  async setMyPrice(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SetCreatorPriceDto,
  ) {
    const userId = (req as any).user?.sub as string;
    return this.works.setPriceByCreator(id, userId, dto.price);
  }
}

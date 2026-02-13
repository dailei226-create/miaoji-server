import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto';
import { Request } from 'express';

type AuthRequest = Request & { user?: { sub?: string } };

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private favorites: FavoritesService) {}

  @Post()
  async create(@Req() req: AuthRequest, @Body() dto: CreateFavoriteDto) {
    const userId = req.user?.sub as string;
    return this.favorites.add(userId, dto.workId);
  }

  @Get()
  async list(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    return this.favorites.list(userId);
  }

  @Delete(':workId')
  async remove(@Req() req: AuthRequest, @Param('workId') workId: string) {
    const userId = req.user?.sub as string;
    return this.favorites.remove(userId, workId);
  }
}

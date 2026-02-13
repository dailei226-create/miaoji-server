import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateFollowDto } from './dto';
import { FollowsService } from './follows.service';

type AuthRequest = Request & { user?: { sub?: string } };

@UseGuards(JwtAuthGuard)
@Controller('follows')
export class FollowsController {
  constructor(private follows: FollowsService) {}

  @Post()
  async create(@Req() req: AuthRequest, @Body() dto: CreateFollowDto) {
    const userId = req.user?.sub as string;
    return this.follows.add(userId, dto.creatorId);
  }

  @Get()
  async list(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    return this.follows.list(userId);
  }

  @Delete(':creatorId')
  async remove(@Req() req: AuthRequest, @Param('creatorId') creatorId: string) {
    const userId = req.user?.sub as string;
    return this.follows.remove(userId, creatorId);
  }
}

import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreatorsService } from './creators.service';

type AuthRequest = Request & { user?: { sub?: string } };

@UseGuards(JwtAuthGuard)
@Controller('creators')
export class CreatorsController {
  constructor(private creators: CreatorsService) {}

  /**
   * 用户端申请成为卖家/创作者
   * POST /creators/apply
   */
  @Post('apply')
  async apply(
    @Req() req: AuthRequest,
    @Body() body: { intro?: string; images?: string[]; isOriginal?: boolean }
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      return { ok: false, message: '请先登录' };
    }
    return this.creators.userApply(userId, body);
  }
}

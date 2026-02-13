// FREEZE(activity): only BUGFIX/STYLE. DO NOT change API contracts / data shape.
// Any modification must include [BUGFIX] or [STYLE] in commit message.

import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { JoinActivityDto, LeaveActivityDto } from './dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private activities: ActivitiesService) {}

  @Get()
  async listPublic() {
    return this.activities.listPublic();
  }
}

@UseGuards(JwtAuthGuard)
@Controller('creator/activity')
export class CreatorActivityController {
  constructor(private activities: ActivitiesService) {}

  /** 获取当前活动 + 已参加/可参加作品 */
  @Get('current')
  async getCurrent(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id || '';
    return this.activities.getCreatorActivityCurrent(userId);
  }

  /** 参加活动 */
  @Post('join')
  async join(@Req() req: any, @Body() dto: JoinActivityDto) {
    const userId = req.user?.sub || req.user?.id || '';
    return this.activities.joinActivity(userId, dto);
  }

  /** 退出活动 */
  @Delete('join')
  async leave(@Req() req: any, @Body() dto: LeaveActivityDto) {
    const userId = req.user?.sub || req.user?.id || '';
    return this.activities.leaveActivity(userId, dto);
  }
}

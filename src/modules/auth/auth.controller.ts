import { Body, Controller, Get, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MockLoginDto } from './dto';
import { Request } from 'express';
import { JwtAuthGuard } from './jwt.guard';
import { Role } from './roles.decorator';

// 环境检查：仅允许开发环境使用 mock 接口
const isDev = process.env.NODE_ENV !== 'production';

type AuthRequestUser = {
  sub?: string;
  role?: string;
  openId?: string;
  nickname?: string | null;
};

type AuthRequest = Request & { user?: AuthRequestUser };

const isRole = (value: string | undefined): value is Role => {
  return value === 'buyer' || value === 'creator' || value === 'admin';
};

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('mock-login')
  async mockLogin(@Body() dto: MockLoginDto) {
    // 非开发环境禁止调用 mock-login
    if (!isDev) {
      throw new ForbiddenException('mock-login is only available in development environment');
    }
    return this.auth.mockLogin({ openId: dto.openId, nickname: dto.nickname, role: dto.role });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    const payload = req.user;
    const role = isRole(payload?.role) ? payload?.role : undefined;
    return this.auth.getMe(userId, {
      role,
      openId: payload?.openId,
      nickname: payload?.nickname ?? null,
    });
  }
}

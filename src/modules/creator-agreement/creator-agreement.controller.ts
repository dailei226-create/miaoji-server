import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreatorAgreementService } from './creator-agreement.service';

type AuthRequest = Request & { user?: { sub?: string } };

@Controller('creator/agreement')
@UseGuards(JwtAuthGuard)
export class CreatorAgreementController {
  constructor(private service: CreatorAgreementService) {}

  private getRequestIp(req: AuthRequest): string {
    const xff = req.headers['x-forwarded-for'];
    if (Array.isArray(xff) && xff.length > 0) {
      return String(xff[0] || '').split(',')[0].trim();
    }
    if (typeof xff === 'string' && xff.trim()) {
      return xff.split(',')[0].trim();
    }
    return String(req.ip || '');
  }

  @Get('status')
  async status(@Req() req: AuthRequest) {
    const userId = req.user?.sub as string;
    return this.service.getStatus(userId);
  }

  @Post('accept')
  async accept(@Req() req: AuthRequest, @Body() _body: Record<string, never>) {
    const userId = req.user?.sub as string;
    const userAgent = String(req.headers['user-agent'] || '');
    const ip = this.getRequestIp(req);
    return this.service.accept(userId, ip, userAgent);
  }
}

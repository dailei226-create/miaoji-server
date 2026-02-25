import { Controller, Post, Body, Req, HttpException, HttpStatus } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsSendDto, SmsVerifyDto } from './dto';
import { Request } from 'express';

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff[0]) return String(xff[0]).split(',')[0].trim();
  return req.socket?.remoteAddress || '0.0.0.0';
}

@Controller('sms')
export class SmsController {
  constructor(private sms: SmsService) {}

  @Post('send')
  async send(@Body() dto: SmsSendDto, @Req() req: Request) {
    try {
      return await this.sms.send(dto.phone, dto.scene, getClientIp(req));
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { ok: false, code: 'internal', message: '发送失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('verify')
  async verify(@Body() dto: SmsVerifyDto) {
    try {
      return await this.sms.verify(dto.phone, dto.scene, dto.code);
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { ok: false, code: 'internal', message: '校验失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

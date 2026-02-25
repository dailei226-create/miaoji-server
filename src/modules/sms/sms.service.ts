import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import Redis from 'ioredis';
import DypnsapiClient, {
  SendSmsVerifyCodeRequest,
  CheckSmsVerifyCodeRequest,
} from '@alicloud/dypnsapi20170525';
import { $OpenApiUtil } from '@alicloud/openapi-core';

const SCENES = ['bank_bind'] as const;
type Scene = (typeof SCENES)[number];
const IP_LIMIT_PER_HOUR = 20;
const COOLDOWN_TTL = 60;

const DEFAULT_SIGN_NAME = '速通互联验证码';
const DEFAULT_TEMPLATE_CODE = '100001';

function err(code: string, message: string, status: number): never {
  throw new HttpException({ ok: false, code, message }, status);
}

@Injectable()
export class SmsService {
  private redis: Redis;
  private aliyun: DypnsapiClient | null = null;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.redis = new Redis(url);
    const ak = process.env.ALIYUN_ACCESS_KEY_ID;
    const sk = process.env.ALIYUN_ACCESS_KEY_SECRET;
    if (ak && sk) {
      const config = new $OpenApiUtil.Config({
        accessKeyId: ak,
        accessKeySecret: sk,
        endpoint: process.env.ALIYUN_SMS_ENDPOINT || 'dypnsapi.aliyuncs.com',
      });
      this.aliyun = new DypnsapiClient(config);
    }
  }

  async send(phone: string, scene: Scene, clientIp: string): Promise<{ ok: boolean }> {
    if (!SCENES.includes(scene)) err('invalid_scene', '场景无效', HttpStatus.BAD_REQUEST);
    if (!/^1\d{10}$/.test(phone)) err('invalid_phone', '手机号格式错误', HttpStatus.BAD_REQUEST);

    const cooldownKey = `sms:cooldown:${scene}:${phone}`;
    if (await this.redis.get(cooldownKey)) {
      err('cooldown', '请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }

    const ipKey = `sms:ip:${clientIp}:h`;
    const ipCount = await this.redis.incr(ipKey);
    if (ipCount === 1) await this.redis.expire(ipKey, 3600);
    if (ipCount > IP_LIMIT_PER_HOUR) {
      err('ip_limit', '发送次数过多，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!this.aliyun) {
      err('sms_disabled', '短信服务未配置', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const signName = process.env.DYPNS_SIGN_NAME || process.env.ALIYUN_SMS_SIGN_NAME || DEFAULT_SIGN_NAME;
    const templateCode = process.env.DYPNS_TEMPLATE_CODE || process.env.ALIYUN_SMS_TEMPLATE_CODE || DEFAULT_TEMPLATE_CODE;
    const validTime = parseInt(process.env.DYPNS_VALID_TIME || '300', 10) || 300;
    const interval = parseInt(process.env.DYPNS_INTERVAL || '60', 10) || 60;
    const codeLength = parseInt(process.env.DYPNS_CODE_LENGTH || '4', 10) || 4;
    const codeType = parseInt(process.env.DYPNS_CODE_TYPE || '1', 10) || 1;

    const req = new SendSmsVerifyCodeRequest({
      phoneNumber: phone.startsWith('86') ? phone : `86${phone}`,
      signName,
      templateCode,
      templateParam: JSON.stringify({ code: '##code##', min: '5' }),
      codeLength,
      codeType,
      validTime,
      interval,
      returnVerifyCode: false,
    });
    try {
      const res = await this.aliyun!.sendSmsVerifyCode(req);
      const body = res?.body;
      const ok = body?.code === 'OK' || body?.success === true;
      if (!ok) {
        const msg = body?.message || '短信发送失败';
        err('sms_fail', msg, HttpStatus.BAD_REQUEST);
      }
    } catch (e: any) {
      const msg = e?.message || e?.data?.message || '短信发送失败';
      err('sms_error', msg, HttpStatus.BAD_GATEWAY);
    }

    await this.redis.setex(cooldownKey, COOLDOWN_TTL, '1');
    return { ok: true };
  }

  async verify(phone: string, scene: Scene, code: string): Promise<{ ok: boolean }> {
    if (!SCENES.includes(scene)) err('invalid_scene', '场景无效', HttpStatus.BAD_REQUEST);
    if (!/^1\d{10}$/.test(phone)) err('invalid_phone', '手机号格式错误', HttpStatus.BAD_REQUEST);

    if (!this.aliyun) {
      err('sms_disabled', '短信服务未配置', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const phoneNumber = phone.startsWith('86') ? phone : `86${phone}`;
    const verifyReq = new CheckSmsVerifyCodeRequest({
      phoneNumber,
      verifyCode: code,
      countryCode: '86',
    });
    try {
      const res = await this.aliyun!.checkSmsVerifyCode(verifyReq);
      const result = res?.body?.model?.verifyResult;
      if (result === 'PASS') {
        return { ok: true };
      }
      err('code_invalid', '验证码错误或已过期', HttpStatus.BAD_REQUEST);
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      const msg = e?.message || e?.data?.message || '校验失败';
      err('verify_error', msg, HttpStatus.BAD_GATEWAY);
    }
  }
}

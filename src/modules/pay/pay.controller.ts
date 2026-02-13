import { Body, Controller, Post, Req, Res, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayService } from './pay.service';
import { CreatePrepayDto } from './dto/create-prepay.dto';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as fs from 'fs';

@Controller('pay')
export class PayController {
  constructor(
    private readonly payService: PayService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('prepay')
  async prepay(@Body() dto: CreatePrepayDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) throw new NotFoundException('order_not_found');
    return this.payService.prepay({
      code: dto.code,
      amount: dto.amount,
      description: dto.description,
      outTradeNo: order.orderNo,
    });
  }

  @Post('notify')
  async notify(@Req() req: Request & { rawBody?: string }, @Res() res: Response) {
    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});

      // 1) 取微信回调头
      const timestamp = String(req.header('Wechatpay-Timestamp') || '');
      const nonce = String(req.header('Wechatpay-Nonce') || '');
      const signature = String(req.header('Wechatpay-Signature') || '');
      const serial = String(req.header('Wechatpay-Serial') || '');

      // 2) 验签（平台证书公钥）
      const platformCertPath =
        this.config.get<string>('WXPAY_PLATFORM_CERT_PATH') ||
        this.config.get<string>('WXPAY_PLATFORM_CERT') ||
        '';

      if (!platformCertPath || !fs.existsSync(platformCertPath)) {
        console.error('[pay/notify] missing platform cert path:', platformCertPath);
        return res.status(500).json({ code: 'FAIL', message: 'missing platform cert' });
      }

      const platformCertPem = fs.readFileSync(platformCertPath, 'utf8');
      const platformPublicKey = crypto.createPublicKey(platformCertPem);

      const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
      const verified = crypto.verify(
        'RSA-SHA256',
        Buffer.from(message, 'utf8'),
        platformPublicKey,
        Buffer.from(signature, 'base64'),
      );

      if (!verified) {
        console.error('[pay/notify] signature verify FAIL', { serial, timestamp, nonce });
        return res.status(401).json({ code: 'FAIL', message: 'signature verify fail' });
      }

      // 3) 解密 resource（AES-256-GCM, APIv3）
      const apiV3Key = this.config.get<string>('WXPAY_API_V3_KEY') || '';
      if (!apiV3Key || apiV3Key.length !== 32) {
        console.error('[pay/notify] invalid api v3 key length');
        return res.status(500).json({ code: 'FAIL', message: 'invalid api v3 key' });
      }

      const body = req.body as any;
      const resource = body?.resource;
      if (!resource?.ciphertext || !resource?.nonce) {
        console.error('[pay/notify] missing resource fields', body);
        return res.status(400).json({ code: 'FAIL', message: 'bad notify body' });
      }

      const decrypted = this.decryptResource({
        apiV3Key,
        ciphertext: resource.ciphertext,
        nonce: resource.nonce,
        associated_data: resource.associated_data || '',
      });

      const payResult = JSON.parse(decrypted);

      // 4) 你后续要更新订单/入库，就从这里开始（先打日志）
      console.log('[pay/notify] VERIFIED & DECRYPTED OK:', {
        event_type: body?.event_type,
        resource_type: body?.resource_type,
        out_trade_no: payResult?.out_trade_no,
        transaction_id: payResult?.transaction_id,
        trade_state: payResult?.trade_state,
        amount: payResult?.amount,
      });

      // 最小闭环：支付成功后更新订单状态为 paid
      if (payResult?.out_trade_no) {
        const data: any = { status: 'paid', paidAt: new Date() };
        if (payResult?.transaction_id) {
          data.transactionId = String(payResult.transaction_id);
        }
        await this.prisma.order.updateMany({
          where: { orderNo: String(payResult.out_trade_no) },
          data,
        });
      }

      // ✅ 告诉微信“我收到了”，否则会不断重试
      return res.status(200).json({ code: 'SUCCESS', message: '成功' });
    } catch (e: any) {
      console.error('[pay/notify] exception:', e?.message || e);
      return res.status(500).json({ code: 'FAIL', message: 'server error' });
    }
  }

  private decryptResource(params: {
    apiV3Key: string;
    ciphertext: string;
    nonce: string;
    associated_data: string;
  }) {
    const { apiV3Key, ciphertext, nonce, associated_data } = params;

    const ct = Buffer.from(ciphertext, 'base64');
    const authTag = ct.subarray(ct.length - 16);
    const data = ct.subarray(0, ct.length - 16);

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(apiV3Key, 'utf8'),
      Buffer.from(nonce, 'utf8'),
    );
    decipher.setAuthTag(authTag);
    if (associated_data) {
      decipher.setAAD(Buffer.from(associated_data, 'utf8'));
    }

    const decoded = Buffer.concat([decipher.update(data), decipher.final()]);
    return decoded.toString('utf8');
  }
}

// MVP一期-支付回调：最小闭环更新订单状态；小程序直连接口=/pay/prepay,/pay/notify

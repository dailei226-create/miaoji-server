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

      // ===== 成功态校验 + 幂等 + 金额一致性校验 =====
      const outTradeNo = payResult?.out_trade_no ? String(payResult.out_trade_no) : '';
      const tradeState = payResult?.trade_state ? String(payResult.trade_state) : '';
      const wxAmountTotal = payResult?.amount?.total;

      if (!outTradeNo) {
        console.error('[pay/notify] missing out_trade_no');
        return res.status(200).json({ code: 'SUCCESS', message: '成功' });
      }

      // 1) 必须 SUCCESS 才更新订单；否则仅记录日志
      if (tradeState !== 'SUCCESS') {
        console.log('[pay/notify] trade_state not SUCCESS, skip update:', { outTradeNo, tradeState });
        return res.status(200).json({ code: 'SUCCESS', message: '成功' });
      }

      // 查询订单（以 orderNo 绑定）
      const order = await this.prisma.order.findFirst({ where: { orderNo: outTradeNo } });
      if (!order) {
        console.error('[pay/notify] order not found for out_trade_no:', outTradeNo);
        return res.status(200).json({ code: 'SUCCESS', message: '成功' });
      }

      // 2) 幂等：已处于支付成功后的任意状态，视为已处理过 SUCCESS
      const alreadyHandledStatuses = new Set([
        'paid',
        'paid_mock',
        'shipped',
        'received',
        'completed',
        'refund_requested',
        'refund_approved',
        'refund_rejected',
        'refunded',
      ]);
      if (alreadyHandledStatuses.has(String(order.status))) {
        console.log('[pay/notify] already handled, skip update:', {
          orderId: order.id,
          orderNo: order.orderNo,
          status: order.status,
        });
        return res.status(200).json({ code: 'SUCCESS', message: '成功' });
      }

      // 3) 金额一致性校验：用 DB 金额对比微信回调金额（单位：分）
      const wxTotalFen = Number(wxAmountTotal);
      const dbTotalFen = Number(order.amount);
      if (!Number.isFinite(wxTotalFen) || wxTotalFen <= 0) {
        console.error('[pay/notify] invalid wx amount.total, skip update:', { outTradeNo, wxAmountTotal });
        return res.status(200).json({ code: 'SUCCESS', message: '成功' });
      }
      if (!Number.isFinite(dbTotalFen) || dbTotalFen <= 0) {
        console.error('[pay/notify] invalid db order.amount, skip update:', { orderId: order.id, dbTotalFen });
        return res.status(200).json({ code: 'SUCCESS', message: '成功' });
      }
      if (wxTotalFen !== dbTotalFen) {
        console.error('[pay/notify] amount mismatch, skip update:', {
          orderId: order.id,
          orderNo: order.orderNo,
          dbTotalFen,
          wxTotalFen,
          transaction_id: payResult?.transaction_id,
        });
        return res.status(200).json({ code: 'SUCCESS', message: '成功' });
      }

      // 条件更新：仅 created -> paid，避免重复写 paidAt / transactionId
      const data: any = { status: 'paid', paidAt: new Date() };
      if (payResult?.transaction_id) data.transactionId = String(payResult.transaction_id);
      const upd = await this.prisma.order.updateMany({
        where: { id: order.id, status: 'created' },
        data,
      });
      if (upd.count !== 1) {
        console.log('[pay/notify] updateMany count!=1 (probably concurrent), skip:', {
          orderId: order.id,
          status: order.status,
          count: upd.count,
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

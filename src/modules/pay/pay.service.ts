import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as crypto from 'crypto';
import axios from 'axios';

function randomNonceStr(len = 32) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

function toUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

/**
 * 微信支付 V3：请求签名串
 * HTTP_METHOD\n
 * URL_PATH\n
 * TIMESTAMP\n
 * NONCE\n
 * BODY\n
 */
function buildWxpayV3Message(
  method: string,
  urlPath: string,
  timestamp: string,
  nonce: string,
  body: string,
) {
  return `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
}

@Injectable()
export class PayService {
  private readonly appid: string;
  private readonly mchid: string;
  private readonly merchantSerial: string;
  private readonly notifyUrl: string;

  // 商户私钥（用于：请求微信支付、以及给小程序返回 paySign）
  private readonly merchantPrivateKeyPem: string;

  constructor(private readonly config: ConfigService) {
    this.appid = this.config.get<string>('WXPAY_APPID') || '';
    this.mchid = this.config.get<string>('WXPAY_MCHID') || '';
    this.merchantSerial = this.config.get<string>('WXPAY_MERCHANT_SERIAL') || '';
    this.notifyUrl = this.config.get<string>('WXPAY_NOTIFY_URL') || '';

    const merchantKeyPath =
      this.config.get<string>('WXPAY_MERCHANT_KEY_PATH') || '';

    if (!this.appid || !this.mchid || !this.merchantSerial || !this.notifyUrl) {
      throw new Error(
        '微信支付配置缺失：请检查 .env 的 WXPAY_APPID / WXPAY_MCHID / WXPAY_MERCHANT_SERIAL / WXPAY_NOTIFY_URL',
      );
    }
    if (!merchantKeyPath) {
      throw new Error(
        '微信支付配置缺失：请检查 .env 的 WXPAY_MERCHANT_KEY_PATH（商户私钥路径）',
      );
    }
    if (!fs.existsSync(merchantKeyPath)) {
      throw new Error(`商户私钥文件不存在：${merchantKeyPath}`);
    }

    this.merchantPrivateKeyPem = fs.readFileSync(merchantKeyPath, 'utf8');
  }

  /**
   * 用 wx.login 的 code 换 openid
   * 需要在 .env 增加一个：WX_APP_SECRET=你的小程序AppSecret
   * （你也可以用 WXPAY_APP_SECRET，二选一）
   */
  private async getOpenidByCode(code: string): Promise<string> {
    const secret =
      this.config.get<string>('WX_APP_SECRET') ||
      this.config.get<string>('WXPAY_APP_SECRET') ||
      '';

    if (!secret) {
      throw new BadRequestException(
        '服务端缺少小程序 AppSecret：请在 .env 增加 WX_APP_SECRET=xxxx（或 WXPAY_APP_SECRET=xxxx）',
      );
    }

    try {
      const url = `https://api.weixin.qq.com/sns/jscode2session`;
      const { data } = await axios.get(url, {
        params: {
          appid: this.appid,
          secret,
          js_code: code,
          grant_type: 'authorization_code',
        },
        timeout: 10000,
      });

      if (!data || data.errcode) {
        // 典型：40029 invalid code
        throw new BadRequestException(
          `code 换 openid 失败：${JSON.stringify(data)}`,
        );
      }

      const openid = data.openid;
      if (!openid) {
        throw new BadRequestException(
          `code 换 openid 失败：未拿到 openid，返回=${JSON.stringify(data)}`,
        );
      }
      return openid;
    } catch (e: any) {
      // 如果上面已经 throw BadRequestException，这里会走到 e.response?
      const detail = e?.response?.data || e?.message || e;
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`code 换 openid 失败：${JSON.stringify(detail)}`);
    }
  }

  /**
   * 生成小程序端 wx.requestPayment 所需参数（RSA）
   * signType 固定：RSA（即 SHA256withRSA）
   */
  private signForMiniapp(prepayId: string) {
    const timeStamp = String(toUnixSeconds());
    const nonceStr = randomNonceStr(32);
    const pkg = `prepay_id=${prepayId}`;

    // 小程序支付签名串：appid\n timeStamp\n nonceStr\n package\n
    const message = `${this.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    sign.end();
    const paySign = sign.sign(this.merchantPrivateKeyPem, 'base64');

    return {
      appId: this.appid,
      timeStamp,
      nonceStr,
      package: pkg,
      signType: 'RSA',
      paySign,
    };
  }

  /**
   * prepay：前端传 code/amount/description
   * 成功时：返回小程序 requestPayment 参数（HTTP 200）
   */
  async prepay(params: { code: string; amount: number; description: string; outTradeNo: string }) {
    if (!params?.code) {
      throw new BadRequestException('缺少 code（请先 wx.login 获取 code）');
    }
    if (!params?.outTradeNo) {
      throw new BadRequestException('缺少 out_trade_no（请先创建订单）');
    }

    const total = Number(params.amount);
    if (!Number.isFinite(total) || total <= 0) {
      throw new BadRequestException('amount 必须是 >0 的数字（单位：分）');
    }

    const openid = await this.getOpenidByCode(params.code);

    // 1) 调微信支付下单接口（JSAPI）
    // 微信接口路径（必须是 path，不含域名）
    const urlPath = '/v3/pay/transactions/jsapi';
    const url = `https://api.mch.weixin.qq.com${urlPath}`;

    const bodyObj = {
      appid: this.appid,
      mchid: this.mchid,
      description: params.description || '妙集-支付链路测试',
      out_trade_no: params.outTradeNo,
      notify_url: this.notifyUrl, // 必须公网可访问
      amount: { total },
      payer: { openid },
    };

    const body = JSON.stringify(bodyObj);

    const timestamp = String(toUnixSeconds());
    const nonce = randomNonceStr(32);

    const message = buildWxpayV3Message('POST', urlPath, timestamp, nonce, body);

    // 2) 给 “请求微信支付” 做签名（商户私钥 RSA-SHA256）
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(message);
    signer.end();
    const signature = signer.sign(this.merchantPrivateKeyPem, 'base64');

    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${this.merchantSerial}",signature="${signature}"`;

    let wxRes: any;
    try {
      wxRes = await axios.post(url, bodyObj, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authorization,
        },
      });
    } catch (e: any) {
      const detail = e?.response?.data || e?.message || e;
      // 这里返回 500，前端看到就是 Internal Server Error，但你能在日志看到 detail
      throw new InternalServerErrorException(
        `微信支付预下单失败：${JSON.stringify(detail)}`,
      );
    }

    const data = wxRes?.data;
    const prepayId = data?.prepay_id;

    if (!prepayId) {
      throw new InternalServerErrorException(
        `预下单失败：未返回 prepay_id，res=${JSON.stringify(data)}`,
      );
    }

    // 3) 返回给小程序拉起支付的参数
    return this.signForMiniapp(prepayId);
  }
}

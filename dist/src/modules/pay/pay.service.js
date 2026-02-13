"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = require("fs");
const crypto = require("crypto");
const axios_1 = require("axios");
function randomNonceStr(len = 32) {
    return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}
function toUnixSeconds() {
    return Math.floor(Date.now() / 1000);
}
function buildWxpayV3Message(method, urlPath, timestamp, nonce, body) {
    return `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
}
let PayService = class PayService {
    constructor(config) {
        this.config = config;
        this.appid = this.config.get('WXPAY_APPID') || '';
        this.mchid = this.config.get('WXPAY_MCHID') || '';
        this.merchantSerial = this.config.get('WXPAY_MERCHANT_SERIAL') || '';
        this.notifyUrl = this.config.get('WXPAY_NOTIFY_URL') || '';
        const merchantKeyPath = this.config.get('WXPAY_MERCHANT_KEY_PATH') || '';
        if (!this.appid || !this.mchid || !this.merchantSerial || !this.notifyUrl) {
            throw new Error('微信支付配置缺失：请检查 .env 的 WXPAY_APPID / WXPAY_MCHID / WXPAY_MERCHANT_SERIAL / WXPAY_NOTIFY_URL');
        }
        if (!merchantKeyPath) {
            throw new Error('微信支付配置缺失：请检查 .env 的 WXPAY_MERCHANT_KEY_PATH（商户私钥路径）');
        }
        if (!fs.existsSync(merchantKeyPath)) {
            throw new Error(`商户私钥文件不存在：${merchantKeyPath}`);
        }
        this.merchantPrivateKeyPem = fs.readFileSync(merchantKeyPath, 'utf8');
    }
    async getOpenidByCode(code) {
        const secret = this.config.get('WX_APP_SECRET') ||
            this.config.get('WXPAY_APP_SECRET') ||
            '';
        if (!secret) {
            throw new common_1.BadRequestException('服务端缺少小程序 AppSecret：请在 .env 增加 WX_APP_SECRET=xxxx（或 WXPAY_APP_SECRET=xxxx）');
        }
        try {
            const url = `https://api.weixin.qq.com/sns/jscode2session`;
            const { data } = await axios_1.default.get(url, {
                params: {
                    appid: this.appid,
                    secret,
                    js_code: code,
                    grant_type: 'authorization_code',
                },
                timeout: 10000,
            });
            if (!data || data.errcode) {
                throw new common_1.BadRequestException(`code 换 openid 失败：${JSON.stringify(data)}`);
            }
            const openid = data.openid;
            if (!openid) {
                throw new common_1.BadRequestException(`code 换 openid 失败：未拿到 openid，返回=${JSON.stringify(data)}`);
            }
            return openid;
        }
        catch (e) {
            const detail = e?.response?.data || e?.message || e;
            if (e instanceof common_1.BadRequestException)
                throw e;
            throw new common_1.BadRequestException(`code 换 openid 失败：${JSON.stringify(detail)}`);
        }
    }
    signForMiniapp(prepayId) {
        const timeStamp = String(toUnixSeconds());
        const nonceStr = randomNonceStr(32);
        const pkg = `prepay_id=${prepayId}`;
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
    async prepay(params) {
        if (!params?.code) {
            throw new common_1.BadRequestException('缺少 code（请先 wx.login 获取 code）');
        }
        if (!params?.outTradeNo) {
            throw new common_1.BadRequestException('缺少 out_trade_no（请先创建订单）');
        }
        const total = Number(params.amount);
        if (!Number.isFinite(total) || total <= 0) {
            throw new common_1.BadRequestException('amount 必须是 >0 的数字（单位：分）');
        }
        const openid = await this.getOpenidByCode(params.code);
        const urlPath = '/v3/pay/transactions/jsapi';
        const url = `https://api.mch.weixin.qq.com${urlPath}`;
        const bodyObj = {
            appid: this.appid,
            mchid: this.mchid,
            description: params.description || '妙集-支付链路测试',
            out_trade_no: params.outTradeNo,
            notify_url: this.notifyUrl,
            amount: { total },
            payer: { openid },
        };
        const body = JSON.stringify(bodyObj);
        const timestamp = String(toUnixSeconds());
        const nonce = randomNonceStr(32);
        const message = buildWxpayV3Message('POST', urlPath, timestamp, nonce, body);
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(message);
        signer.end();
        const signature = signer.sign(this.merchantPrivateKeyPem, 'base64');
        const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${this.merchantSerial}",signature="${signature}"`;
        let wxRes;
        try {
            wxRes = await axios_1.default.post(url, bodyObj, {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: authorization,
                },
            });
        }
        catch (e) {
            const detail = e?.response?.data || e?.message || e;
            throw new common_1.InternalServerErrorException(`微信支付预下单失败：${JSON.stringify(detail)}`);
        }
        const data = wxRes?.data;
        const prepayId = data?.prepay_id;
        if (!prepayId) {
            throw new common_1.InternalServerErrorException(`预下单失败：未返回 prepay_id，res=${JSON.stringify(data)}`);
        }
        return this.signForMiniapp(prepayId);
    }
};
exports.PayService = PayService;
exports.PayService = PayService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PayService);
//# sourceMappingURL=pay.service.js.map
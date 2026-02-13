// 端到端测试：订单流程（含确认收货和申请退款）
const http = require('http');

const BASE = 'http://127.0.0.1:3100';
const ADMIN_OPENID = 'oVKZD5GRkMfGPTQC_ADMIN_001';
const SELLER_OPENID = 'test_seller_flow_' + Date.now();
const BUYER_OPENID = 'test_buyer_flow_' + Date.now();

function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;

    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function login(openId, role) {
  const res = await req('POST', '/auth/mock-login', null, { openId, role: role || 'buyer' });
  const token = res.data.access_token || res.data.token;
  if (!token) throw new Error('登录失败');
  return { token, user: res.data.user };
}

async function main() {
  console.log('=== 端到端订单流程测试 ===\n');

  // 1. 创建卖家并审批
  console.log('1) 创建卖家');
  const { token: sellerToken, user: seller } = await login(SELLER_OPENID, 'buyer');
  await req('POST', '/creators/apply', sellerToken, { intro: '卖家', images: [], isOriginal: true });
  const { token: adminToken } = await login(ADMIN_OPENID, 'admin');
  await req('POST', `/admin/creators/${seller.id}/approve`, adminToken);
  console.log('   卖家 ID:', seller.id);

  // 2. 创建作品
  console.log('2) 创建作品');
  const workRes = await req('POST', '/works/me/draft', sellerToken, {
    title: '测试商品',
    desc: '用于订单流程测试',
    price: 1000,
    stock: 10,
    support7days: true,
    images: ['https://example.com/test.jpg'],
    categoryId: 'cat_default'
  });
  console.log('   作品创建:', workRes.status);
  const workId = workRes.data?.id || workRes.data?.work?.id;
  if (!workId) {
    console.log('   作品创建失败，跳过订单测试');
    console.log('   Response:', JSON.stringify(workRes.data));
    return;
  }
  console.log('   作品 ID:', workId);

  // 提交审核并上线
  await req('POST', `/works/me/${workId}/submit`, sellerToken);
  await req('POST', `/admin/works/${workId}/approve`, adminToken);

  // 3. 创建买家并添加地址
  console.log('3) 买家创建地址');
  const { token: buyerToken, user: buyer } = await login(BUYER_OPENID, 'buyer');
  const addrRes = await req('POST', '/addresses', buyerToken, {
    name: '张三',
    phone: '13800138000',
    province: '广东',
    city: '深圳',
    district: '南山区',
    detail: '测试地址123号'
  });
  const addressId = addrRes.data?.id || addrRes.data?.address?.id;
  console.log('   地址创建:', addrRes.status, addressId ? '成功' : '失败');
  if (!addressId) {
    console.log('   地址响应:', JSON.stringify(addrRes.data));
    return;
  }

  // 4. 下单
  console.log('4) 买家下单');
  const orderRes = await req('POST', '/orders', buyerToken, {
    workId,
    qty: 1,
    addressId
  });
  console.log('   下单:', orderRes.status);
  const orderId = orderRes.data?.id || orderRes.data?.order?.id;
  if (!orderId) {
    console.log('   下单失败:', JSON.stringify(orderRes.data));
    return;
  }
  console.log('   订单 ID:', orderId);

  // 5. 模拟支付
  console.log('5) 模拟支付');
  const payRes = await req('POST', `/orders/${orderId}/mock-pay`, buyerToken);
  console.log('   支付:', payRes.status, payRes.data?.status);

  // 6. 卖家发货
  console.log('6) 卖家发货');
  const shipRes = await req('POST', `/orders/${orderId}/ship`, sellerToken, {
    expressCompany: '顺丰',
    expressNo: 'SF123456789'
  });
  console.log('   发货:', shipRes.status, shipRes.data?.status || shipRes.data?.message);

  // 7. 买家确认收货
  console.log('7) 买家确认收货');
  const confirmRes = await req('POST', `/orders/${orderId}/confirm-receipt`, buyerToken);
  console.log('   确认收货:', confirmRes.status, confirmRes.data?.status || confirmRes.data?.ok);

  // 查看订单状态
  const detailRes = await req('GET', `/orders/${orderId}`, buyerToken);
  console.log('   订单状态:', detailRes.data?.status);

  console.log('\n=== 测试退款流程（新订单）===\n');

  // 新订单测试退款
  const order2Res = await req('POST', '/orders', buyerToken, {
    workId,
    qty: 1,
    addressId
  });
  const order2Id = order2Res.data?.id;
  if (!order2Id) {
    console.log('下单失败');
    return;
  }
  console.log('8) 新订单 ID:', order2Id);

  // 支付
  await req('POST', `/orders/${order2Id}/mock-pay`, buyerToken);
  console.log('   已支付');

  // 申请退款
  console.log('9) 申请退款');
  const refundReqRes = await req('POST', `/orders/${order2Id}/request-refund`, buyerToken, {
    reason: '不想要了',
    type: 'refund'
  });
  console.log('   申请退款:', refundReqRes.status, refundReqRes.data?.status || refundReqRes.data?.ok);

  // 查看订单状态
  const detail2Res = await req('GET', `/orders/${order2Id}`, buyerToken);
  console.log('   订单状态:', detail2Res.data?.status);

  console.log('\n=== 测试完成 ===');
}

main().catch(console.error);

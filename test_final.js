// 最终综合测试
const http = require('http');

const BASE = 'http://127.0.0.1:3100';
const ADMIN_OPENID = 'oVKZD5GRkMfGPTQC_ADMIN_001';
const TEST_OPENID = 'test_final_' + Date.now();

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
  console.log('===== 综合测试 =====\n');

  // 1. 用户登录
  console.log('1) 用户登录');
  const { token: userToken, user } = await login(TEST_OPENID, 'buyer');
  console.log('   userId:', user.id);

  // 2. 初始 /me 状态
  console.log('\n2) 初始 /me 状态');
  const me1 = await req('GET', '/me', userToken);
  console.log('   creatorStatus:', me1.data.creatorStatus);
  console.log('   isCreator:', me1.data.isCreator);

  // 3. 申请成为创作者
  console.log('\n3) 申请成为创作者');
  const applyRes = await req('POST', '/creators/apply', userToken, {
    intro: '综合测试创作者申请',
    images: ['https://example.com/test.jpg'],
    isOriginal: true,
    nickname: '测试用户',
    realName: '张三',
    phone: '13800138000'
  });
  console.log('   申请结果:', applyRes.status, applyRes.data.ok ? '成功' : applyRes.data.message);

  // 4. 申请后 /me 状态
  console.log('\n4) 申请后 /me 状态');
  const me2 = await req('GET', '/me', userToken);
  console.log('   creatorStatus:', me2.data.creatorStatus);
  console.log('   预期: PENDING');

  // 5. Admin 审批
  console.log('\n5) Admin 审批通过');
  const { token: adminToken } = await login(ADMIN_OPENID, 'admin');
  const approveRes = await req('POST', `/admin/creators/${user.id}/approve`, adminToken);
  console.log('   审批结果:', approveRes.status, approveRes.data.ok ? '成功' : '失败');

  // 6. 审批后 /me 状态
  console.log('\n6) 审批后 /me 状态');
  const me3 = await req('GET', '/me', userToken);
  console.log('   creatorStatus:', me3.data.creatorStatus);
  console.log('   isCreator:', me3.data.isCreator);
  console.log('   预期: APPROVED, true');

  // 7. 站内信
  console.log('\n7) 站内信验证');
  const notices = await req('GET', '/me/notices?page=1&pageSize=10', userToken);
  const noticeList = notices.data.items || [];
  console.log('   收到通知数:', noticeList.length);
  if (noticeList.length > 0) {
    console.log('   最新通知:', noticeList[0].title);
  }

  // 8. 卖家订单接口
  console.log('\n8) 卖家订单接口');
  const sellerOrders = await req('GET', '/orders/seller', userToken);
  console.log('   状态码:', sellerOrders.status);
  console.log('   订单数:', Array.isArray(sellerOrders.data) ? sellerOrders.data.length : (sellerOrders.data.items || []).length);

  console.log('\n===== 证据汇总 =====');
  console.log('1) /me creatorStatus=APPROVED 时，前端应显示"发布作品"');
  console.log('2) 提交申请后 /me creatorStatus=PENDING，前端应显示"审核中"');
  console.log('3) 卖家订单接口 /orders/seller 返回 ' + sellerOrders.status);
  console.log('4) 站内信已发送（通知数：' + noticeList.length + '）');
}

main().catch(console.error);

// 收款账号 payout 功能端到端测试
const http = require('http');

const BASE = 'http://127.0.0.1:3100';
const ADMIN_OPENID = 'oVKZD5GRkMfGPTQC_ADMIN_001'; // 管理员
const TEST_OPENID = 'test_payout_user_' + Date.now();

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
  if ((res.status !== 201 && res.status !== 200) || !token) {
    throw new Error('登录失败: ' + JSON.stringify(res.data));
  }
  return token;
}

async function main() {
  console.log('=== 1. 测试用户登录 ===');
  const userToken = await login(TEST_OPENID, 'buyer');
  console.log('用户 Token:', userToken.slice(0, 30) + '...');

  console.log('\n=== 2. GET /me/payout (应为 null) ===');
  const r1 = await req('GET', '/me/payout', userToken);
  console.log('Status:', r1.status);
  console.log('Response:', JSON.stringify(r1.data, null, 2));

  console.log('\n=== 3. PUT /me/payout (保存收款信息) ===');
  const payoutData = {
    realnameAuthed: true,
    holderName: '张三',
    holderIdNumber: '110101199001011234',
    reservedPhone: '13812345678',
    cardNumber: '6222021234567890123',
    bankName: '中国工商银行',
    branchName: '北京朝阳支行',
  };
  const r2 = await req('PUT', '/me/payout', userToken, payoutData);
  console.log('Status:', r2.status);
  console.log('Response:', JSON.stringify(r2.data, null, 2));

  console.log('\n=== 4. GET /me/payout (应返回已保存数据) ===');
  const r3 = await req('GET', '/me/payout', userToken);
  console.log('Status:', r3.status);
  console.log('Response:', JSON.stringify(r3.data, null, 2));

  console.log('\n=== 5. 管理员登录 ===');
  const adminToken = await login(ADMIN_OPENID, 'admin');
  console.log('Admin Token:', adminToken.slice(0, 30) + '...');

  // 获取用户 ID
  const meRes = await req('GET', '/me', userToken);
  const userId = meRes.data.id || meRes.data.sub;
  console.log('User ID:', userId);

  console.log('\n=== 6. GET /admin/creators/:userId/payout (脱敏数据) ===');
  const r4 = await req('GET', `/admin/creators/${userId}/payout`, adminToken);
  console.log('Status:', r4.status);
  console.log('Response:', JSON.stringify(r4.data, null, 2));

  console.log('\n=== 7. POST /admin/creators/:userId/payout/verify ===');
  const r5 = await req('POST', `/admin/creators/${userId}/payout/verify`, adminToken);
  console.log('Status:', r5.status);
  console.log('Response:', JSON.stringify(r5.data, null, 2));

  console.log('\n=== 8. GET /admin/creators/:userId/payout (验证后状态) ===');
  const r6 = await req('GET', `/admin/creators/${userId}/payout`, adminToken);
  console.log('Status:', r6.status);
  console.log('Response:', JSON.stringify(r6.data, null, 2));

  console.log('\n=== 9. SQL 验证: 查询 CreatorPayout 表 ===');
  // 由于无法直接执行 SQL，打印提示
  console.log(`SELECT * FROM CreatorPayout WHERE userId = '${userId}'`);

  console.log('\n=== 测试完成 ===');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});

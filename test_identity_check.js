// 第0部分：钉死身份与状态来源
const http = require('http');

const BASE = 'http://127.0.0.1:3100';
const ADMIN_OPENID = 'oVKZD5GRkMfGPTQC_ADMIN_001';
// 使用一个固定的测试用户（模拟小程序端）
const TEST_OPENID = 'test_creator_sync_check';

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
  return { token, user: res.data.user };
}

async function main() {
  console.log('=== 第0部分：钉死身份与状态来源 ===\n');
  
  // 1. 用户登录（模拟小程序）
  console.log('1) 用户登录');
  const { token: userToken, user } = await login(TEST_OPENID, 'buyer');
  const userId = user.id;
  console.log('   userId:', userId);
  console.log('   openId:', user.openId);

  // 2. 申请创作者（如果还没申请）
  console.log('\n2) 申请成为创作者');
  const applyRes = await req('POST', '/creators/apply', userToken, {
    intro: '测试创作者申请，用于验证状态同步',
    images: ['https://example.com/test.jpg'],
    isOriginal: true,
    nickname: '测试用户',
    realName: '张三',
    phone: '13800138000'
  });
  console.log('   申请结果:', applyRes.status, JSON.stringify(applyRes.data));

  // 3. GET /me 查看状态
  console.log('\n3) GET /me response');
  const meRes = await req('GET', '/me', userToken);
  console.log('   userId:', meRes.data.id);
  console.log('   creatorStatus:', meRes.data.creatorStatus);
  console.log('   isCreator:', meRes.data.isCreator);

  // 4. Admin 查看该用户的 CreatorProfile
  console.log('\n4) Admin 查看 CreatorProfile');
  const { token: adminToken } = await login(ADMIN_OPENID, 'admin');
  const profileRes = await req('GET', `/admin/creators/${userId}`, adminToken);
  console.log('   CreatorProfile status:', profileRes.data.profile?.status || profileRes.data.status);

  // 5. Admin 审批通过
  console.log('\n5) Admin 审批通过');
  const approveRes = await req('POST', `/admin/creators/${userId}/approve`, adminToken);
  console.log('   审批结果:', approveRes.status, JSON.stringify(approveRes.data));

  // 6. 再次 GET /me 验证状态
  console.log('\n6) 审批后 GET /me');
  const meRes2 = await req('GET', '/me', userToken);
  console.log('   userId:', meRes2.data.id);
  console.log('   creatorStatus:', meRes2.data.creatorStatus);
  console.log('   isCreator:', meRes2.data.isCreator);

  // 7. 结论
  console.log('\n=== 结论 ===');
  if (meRes2.data.creatorStatus === 'APPROVED' && meRes2.data.isCreator === true) {
    console.log('✓ 后端状态同步正确：creatorStatus=APPROVED, isCreator=true');
    console.log('  若小程序仍显示"创作者申请"，问题在前端缓存/判断逻辑');
  } else {
    console.log('✗ 后端状态异常，需检查 auth.service.ts getMe 方法');
  }
}

main().catch(console.error);

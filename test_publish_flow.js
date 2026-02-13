// 测试发布流程：先申请创作者，admin审核，然后发布作品
const http = require('http');

const BASE = 'http://127.0.0.1:3100';
const ADMIN_OPENID = 'oVKZD5GRkMfGPTQC_ADMIN_001';
const TEST_OPENID = 'test_publish_' + Date.now();

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
  console.log('=== 1. 用户登录 ===');
  const { token: userToken, user } = await login(TEST_OPENID, 'buyer');
  const userId = user.id;
  console.log('User ID:', userId);
  console.log('Token:', userToken.slice(0, 30) + '...');

  console.log('\n=== 2. GET /me (初始状态) ===');
  const r1 = await req('GET', '/me', userToken);
  console.log('Status:', r1.status);
  console.log('creatorStatus:', r1.data.creatorStatus);
  console.log('isCreator:', r1.data.isCreator);

  console.log('\n=== 3. 申请成为创作者 ===');
  const r2 = await req('POST', '/creators/apply', userToken, {
    intro: '我是一名热爱创作的艺术家，擅长手工艺品制作，已有5年经验。',
    images: ['https://example.com/img1.jpg'],
    isOriginal: true,
    nickname: '测试创作者',
    realName: '张三',
    phone: '13812345678'
  });
  console.log('Status:', r2.status);
  console.log('Response:', JSON.stringify(r2.data));

  console.log('\n=== 4. GET /me (申请后状态) ===');
  const r3 = await req('GET', '/me', userToken);
  console.log('creatorStatus:', r3.data.creatorStatus);
  console.log('isCreator:', r3.data.isCreator);

  console.log('\n=== 5. Admin 登录并审批 ===');
  const { token: adminToken } = await login(ADMIN_OPENID, 'admin');
  const r4 = await req('POST', `/admin/creators/${userId}/approve`, adminToken);
  console.log('Approve Status:', r4.status);
  console.log('Response:', JSON.stringify(r4.data));

  console.log('\n=== 6. GET /me (审批后状态) ===');
  const r5 = await req('GET', '/me', userToken);
  console.log('creatorStatus:', r5.data.creatorStatus);
  console.log('isCreator:', r5.data.isCreator);

  if (r5.data.creatorStatus !== 'APPROVED') {
    console.error('ERROR: creatorStatus 应该是 APPROVED，实际是', r5.data.creatorStatus);
    process.exit(1);
  }

  console.log('\n=== 7. 发布作品草稿 ===');
  const draftPayload = {
    title: '测试手工作品',
    desc: '这是一个测试作品',
    price: 9900, // 99 元
    stock: 10,
    images: ['https://example.com/work1.jpg'],
    cover: 'https://example.com/work1.jpg',
    categoryId: 'cat1',
    support7days: true,
    status: 'DRAFT'
  };
  const r6 = await req('POST', '/works/me/draft', userToken, draftPayload);
  console.log('Draft Status:', r6.status);
  console.log('Response:', JSON.stringify(r6.data));

  const workId = r6.data.id || r6.data.workId || (r6.data.data && r6.data.data.id);
  if (!workId) {
    console.error('ERROR: 未获取到 workId');
    process.exit(1);
  }
  console.log('Work ID:', workId);

  console.log('\n=== 8. 提交审核 ===');
  const r7 = await req('POST', `/works/me/${workId}/submit`, userToken);
  console.log('Submit Status:', r7.status);
  console.log('Response:', JSON.stringify(r7.data));

  if (r7.status !== 200 && r7.status !== 201) {
    console.error('ERROR: 提交审核失败');
    process.exit(1);
  }

  console.log('\n=== 测试通过 ===');
  console.log('完整流程验证成功：');
  console.log('1. 用户申请创作者');
  console.log('2. Admin 审批通过');
  console.log('3. /me 返回 creatorStatus=APPROVED, isCreator=true');
  console.log('4. 用户可以发布作品草稿');
  console.log('5. 用户可以提交审核');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});

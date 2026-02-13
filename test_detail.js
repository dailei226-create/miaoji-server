const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3100,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== 测试详情接口完整性 ===\n');

  // 1. 创建用户并申请（模拟小程序提交的完整 payload）
  const testOpenId = 'detail_test_' + Date.now();
  const userRes = await request('POST', '/auth/mock-login', null, { openId: testOpenId, role: 'user', nickname: '手工艺人小王' });
  const USER_TOKEN = userRes.data.token;
  const USER_ID = userRes.data.user.id;
  console.log('测试用户 ID:', USER_ID);

  // A. 小程序申请 request body（完整 payload）
  const applyPayload = {
    intro: '专业手工艺品制作，从业10年经验',
    images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
    isOriginal: true,
    phone: '13900001111',
    realName: '王小明',
    nickname: '手工艺人小王'
  };
  console.log('\n=== A. 小程序申请 request body ===');
  console.log(JSON.stringify(applyPayload, null, 2));

  const applyRes = await request('POST', '/creators/apply', USER_TOKEN, applyPayload);
  console.log('Response Status:', applyRes.status);
  console.log('Response Body:', JSON.stringify(applyRes.data));

  // B. SQL 查询 applyData/appliedAt/status 原值
  console.log('\n=== B. SQL: CreatorProfile 原始值 ===');
  const profileRaw = await prisma.$queryRawUnsafe(
    'SELECT id, userId, status, applyData, appliedAt, createdAt FROM CreatorProfile WHERE userId = ?',
    USER_ID
  );
  if (profileRaw && profileRaw.length > 0) {
    const p = profileRaw[0];
    console.log('status:', p.status);
    console.log('appliedAt:', p.appliedAt);
    console.log('applyData:', JSON.stringify(p.applyData, null, 2));
  }

  // C. admin-web 详情接口 GET /admin/creators/:userId
  console.log('\n=== C. admin-web 详情接口 ===');
  const adminRes = await request('POST', '/auth/mock-login', null, { openId: 'admin_test', role: 'admin' });
  const ADMIN_TOKEN = adminRes.data.token;

  console.log('GET /admin/creators/' + USER_ID);
  const detailRes = await request('GET', `/admin/creators/${USER_ID}`, ADMIN_TOKEN);
  console.log('Response Status:', detailRes.status);
  console.log('Response Body:', JSON.stringify(detailRes.data, null, 2));

  // D. 验证详情中各字段是否完整
  console.log('\n=== D. 验证详情字段完整性 ===');
  const detail = detailRes.data;
  const profile = detail.profile || detail;
  const applyData = typeof profile.applyData === 'string' ? JSON.parse(profile.applyData) : (profile.applyData || {});
  
  console.log('nickname:', applyData.nickname || profile.nickname || '(空)');
  console.log('phone:', applyData.phone || profile.phone || '(空)');
  console.log('realName:', applyData.realName || profile.realName || '(空)');
  console.log('intro:', applyData.intro || '(空)');
  console.log('images:', JSON.stringify(applyData.images || []));
  console.log('isOriginal:', applyData.isOriginal);

  await prisma.$disconnect();
  console.log('\n=== 测试完成 ===');
}

main().catch(e => console.error(e));

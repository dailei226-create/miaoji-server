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
  console.log('=== 完整自测：创作者申请与审核 ===\n');

  // 1. 创建一个新用户并提交申请
  const testOpenId = 'review_test_' + Date.now();
  const userRes = await request('POST', '/auth/mock-login', null, { openId: testOpenId, role: 'user' });
  const USER_TOKEN = userRes.data.token;
  const USER_ID = userRes.data.user.id;
  console.log('测试用户 ID:', USER_ID);

  // A. 小程序申请：Network 请求与响应
  console.log('\n=== A. 小程序申请接口测试 ===');
  console.log('URL: POST /creators/apply');
  const applyRes = await request('POST', '/creators/apply', USER_TOKEN, {
    intro: '我是手工达人，专注手工制作5年',
    images: ['https://test.com/work1.jpg', 'https://test.com/work2.jpg'],
    isOriginal: true,
    phone: '13812345678',
    realName: '张三'
  });
  console.log('Request Body: { intro, images, isOriginal, phone, realName }');
  console.log('Response Status:', applyRes.status);
  console.log('Response Body:', JSON.stringify(applyRes.data));

  // B. SQL: 查询 CreatorProfile 原始值
  console.log('\n=== B. 数据库原始值 ===');
  const profileRaw = await prisma.$queryRawUnsafe(
    'SELECT id, userId, status, phone, realName, applyData, appliedAt, createdAt FROM CreatorProfile WHERE userId = ?',
    USER_ID
  );
  console.log('CreatorProfile:');
  if (profileRaw && profileRaw.length > 0) {
    const p = profileRaw[0];
    console.log('  - id:', p.id);
    console.log('  - userId:', p.userId);
    console.log('  - status:', p.status);
    console.log('  - phone:', p.phone);
    console.log('  - realName:', p.realName);
    console.log('  - applyData:', JSON.stringify(p.applyData));
    console.log('  - appliedAt:', p.appliedAt);
    console.log('  - createdAt:', p.createdAt);
  }

  // C. Admin 获取 pending 列表
  console.log('\n=== C. Admin 查看 pending 列表 ===');
  const adminRes = await request('POST', '/auth/mock-login', null, { openId: 'admin_test', role: 'admin' });
  const ADMIN_TOKEN = adminRes.data.token;
  
  const listRes = await request('GET', '/admin/creators?status=pending', ADMIN_TOKEN);
  console.log('GET /admin/creators?status=pending');
  console.log('Status:', listRes.status);
  const items = listRes.data.items || [];
  const found = items.find(it => it.userId === USER_ID);
  if (found) {
    console.log('找到待审核记录:');
    console.log('  - userId:', found.userId);
    console.log('  - phone:', found.phone);
    console.log('  - realName:', found.realName);
    console.log('  - applyData:', JSON.stringify(found.applyData));
  } else {
    console.log('未找到待审核记录');
  }

  // D. 点击通过
  console.log('\n=== D. 点击通过 ===');
  console.log('URL: POST /admin/creators/' + USER_ID + '/approve');
  const approveRes = await request('POST', `/admin/creators/${USER_ID}/approve`, ADMIN_TOKEN);
  console.log('Response Status:', approveRes.status);
  console.log('Response Body:', JSON.stringify(approveRes.data));

  // 验证状态变更
  const afterApprove = await prisma.$queryRawUnsafe(
    'SELECT id, status FROM CreatorProfile WHERE userId = ?',
    USER_ID
  );
  console.log('审核后 status:', afterApprove[0]?.status);

  // 验证操作日志
  if (afterApprove && afterApprove.length > 0) {
    const logs = await prisma.$queryRawUnsafe(
      'SELECT id, action, fromStatus, toStatus, createdAt FROM CreatorOpLog WHERE creatorProfileId = ? ORDER BY createdAt DESC',
      afterApprove[0].id
    );
    console.log('操作日志:', logs.map(l => `${l.action}: ${l.fromStatus} -> ${l.toStatus}`).join(', '));
  }

  await prisma.$disconnect();
  console.log('\n=== 自测完成 ===');
}

main().catch(e => console.error(e));

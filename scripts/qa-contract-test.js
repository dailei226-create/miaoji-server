/**
 * QA 契约测试脚本
 * 基于规范文档验证 API 接口
 */

const http = require('http');

const BASE = 'http://localhost:3100';
let BUYER_TOKEN = '';
let CREATOR_TOKEN = '';
let ADMIN_TOKEN = '';

function request(method, path, body, token) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, data: json, raw: data.slice(0, 200) });
      });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('QA 契约测试 - 基于规范文档');
  console.log('='.repeat(60));

  // 获取 Tokens
  console.log('\n--- 获取测试 Token ---');
  const r1 = await request('POST', '/auth/mock-login', { openId: 'qa_buyer', nickname: 'QABuyer', role: 'buyer' });
  if (r1.status === 200 || r1.status === 201) {
    BUYER_TOKEN = r1.data.token;
    console.log('[OK] Buyer token obtained, userId:', r1.data.user?.id);
  } else {
    console.log('[FAIL] Buyer token:', r1.status, r1.error || r1.raw);
  }

  const r2 = await request('POST', '/auth/mock-login', { openId: 'qa_creator', nickname: 'QACreator', role: 'creator' });
  if (r2.status === 200 || r2.status === 201) {
    CREATOR_TOKEN = r2.data.token;
    console.log('[OK] Creator token obtained, userId:', r2.data.user?.id);
  }

  const r3 = await request('POST', '/auth/mock-login', { openId: 'qa_admin', nickname: 'QAAdmin', role: 'admin' });
  if (r3.status === 200 || r3.status === 201) {
    ADMIN_TOKEN = r3.data.token;
    console.log('[OK] Admin token obtained, userId:', r3.data.user?.id);
  }

  // 契约清单测试
  console.log('\n' + '='.repeat(60));
  console.log('B. API 契约清单核对');
  console.log('='.repeat(60));

  const tests = [
    // 认证
    { name: 'POST /auth/login', method: 'POST', path: '/auth/login', body: { code: 'test' }, doc: '文档要求' },
    { name: 'GET /me', method: 'GET', path: '/me', token: 'buyer', doc: '文档要求' },

    // 作品
    { name: 'GET /works', method: 'GET', path: '/works', doc: '文档要求' },
    { name: 'GET /works/:id', method: 'GET', path: '/works/w_001', doc: '文档要求' },
    { name: 'POST /works', method: 'POST', path: '/works', body: {}, token: 'creator', doc: '文档要求' },
    { name: 'PUT /works/:id', method: 'PUT', path: '/works/w_001', body: {}, token: 'creator', doc: '文档要求' },
    { name: 'POST /works/:id/shelf', method: 'POST', path: '/works/w_001/shelf', body: {}, token: 'creator', doc: '文档要求' },

    // 订单
    { name: 'POST /orders/preview', method: 'POST', path: '/orders/preview', body: {}, token: 'buyer', doc: '文档要求' },
    { name: 'POST /orders', method: 'POST', path: '/orders', body: {}, token: 'buyer', doc: '文档要求' },
    { name: 'GET /orders?role=buyer', method: 'GET', path: '/orders?role=buyer', token: 'buyer', doc: '文档要求' },
    { name: 'GET /orders?role=seller', method: 'GET', path: '/orders?role=seller', token: 'creator', doc: '文档要求' },
    { name: 'POST /orders/:id/ship', method: 'POST', path: '/orders/test/ship', body: {}, token: 'creator', doc: '文档要求' },
    { name: 'POST /orders/:id/cancel', method: 'POST', path: '/orders/test/cancel', body: {}, token: 'buyer', doc: '文档要求' },

    // 地址
    { name: 'GET /addresses', method: 'GET', path: '/addresses', token: 'buyer', doc: '文档要求' },
    { name: 'POST /addresses', method: 'POST', path: '/addresses', body: { name: 'test' }, token: 'buyer', doc: '文档要求' },
    { name: 'PUT /addresses/:id', method: 'PUT', path: '/addresses/test', body: {}, token: 'buyer', doc: '文档要求' },
    { name: 'DELETE /addresses/:id', method: 'DELETE', path: '/addresses/test', token: 'buyer', doc: '文档要求' },

    // 关注
    { name: 'POST /follow', method: 'POST', path: '/follow', body: {}, token: 'buyer', doc: '文档要求' },
    { name: 'DELETE /follow/:sellerId', method: 'DELETE', path: '/follow/test', token: 'buyer', doc: '文档要求' },
    { name: 'GET /follow/list', method: 'GET', path: '/follow/list', token: 'buyer', doc: '文档要求' },

    // 创作者
    { name: 'GET /creator/profile', method: 'GET', path: '/creator/profile', token: 'buyer', doc: '文档要求' },
    { name: 'POST /creator/apply', method: 'POST', path: '/creator/apply', body: {}, token: 'buyer', doc: '文档要求' },
    { name: 'POST /creator/bank', method: 'POST', path: '/creator/bank', body: {}, token: 'creator', doc: '文档要求' },

    // 实际实现的路由（对比）
    { name: 'GET /follows (实际)', method: 'GET', path: '/follows', token: 'buyer', doc: '实际实现' },
    { name: 'POST /follows (实际)', method: 'POST', path: '/follows', body: { creatorId: 'test' }, token: 'buyer', doc: '实际实现' },
    { name: 'POST /creators/apply (实际)', method: 'POST', path: '/creators/apply', body: {}, token: 'buyer', doc: '实际实现' },
    { name: 'GET /orders (实际)', method: 'GET', path: '/orders', token: 'buyer', doc: '实际实现' },
    { name: 'GET /orders/seller (实际)', method: 'GET', path: '/orders/seller', token: 'creator', doc: '实际实现' },
  ];

  const results = [];
  for (const t of tests) {
    const token = t.token === 'buyer' ? BUYER_TOKEN : t.token === 'creator' ? CREATOR_TOKEN : t.token === 'admin' ? ADMIN_TOKEN : null;
    const res = await request(t.method, t.path, t.body, token);
    const status = res.status === 200 || res.status === 201 ? 'EXISTS' : res.status === 404 ? 'NOT_FOUND' : res.status === 401 ? 'UNAUTHORIZED' : res.status === 400 ? 'BAD_REQUEST' : `ERROR(${res.status})`;
    results.push({ ...t, result: status, code: res.status });
    console.log(`[${status.padEnd(12)}] ${t.name} (${t.doc})`);
  }

  // 输出汇总
  console.log('\n' + '='.repeat(60));
  console.log('汇总');
  console.log('='.repeat(60));
  const found = results.filter(r => r.result === 'EXISTS').length;
  const notFound = results.filter(r => r.result === 'NOT_FOUND').length;
  console.log(`EXISTS: ${found}, NOT_FOUND: ${notFound}, OTHER: ${results.length - found - notFound}`);
}

main().catch(console.error);

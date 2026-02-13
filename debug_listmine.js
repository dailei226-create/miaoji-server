// debug_listmine.js
// 用法：node debug_listmine.js
// 目标：一键复现 登录 -> 创建draft -> submit -> list(reviewing)，并把关键结果打印出来

const base = process.env.BASE_URL || 'http://localhost:3101';

async function readText(res) {
  const t = await res.text();
  try { return { text: t, json: JSON.parse(t) }; } catch { return { text: t, json: null }; }
}

async function main() {
  console.log('BASE =', base);

  // 1) mock login
  const loginRes = await fetch(`${base}/auth/mock-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openId: 'debug_user_2', nickname: 'debug2', role: 'creator' }),
  });
  const login = await loginRes.json();
  const token = login.token;
  if (!token) {
    console.error('LOGIN FAILED:', login);
    process.exit(1);
  }
  console.log('login_status =', loginRes.status);
  console.log('token_prefix =', String(token).slice(0, 16) + '...');

  const headersJson = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const headersAuthOnly = { Authorization: `Bearer ${token}` };

  // 2) create draft
  const draftPayload = {
    title: 'debug',
    desc: 'debug',
    price: 9,
    stock: 1,
    images: ['https://example.com/a.png'],
    support7days: true,
  };

  const draftRes = await fetch(`${base}/works/me/draft`, {
    method: 'POST',
    headers: headersJson,
    body: JSON.stringify(draftPayload),
  });
  const draftBody = await readText(draftRes);
  console.log('draft_status =', draftRes.status);
  console.log('draft_response =', draftBody.text);

  // 兼容 workId / id 两种返回
  const workId =
    (draftBody.json && (draftBody.json.workId || draftBody.json.id)) ||
    null;

  if (!workId) {
    console.error('Cannot find workId/id from draft response.');
    process.exit(1);
  }
  console.log('workId =', workId);

  // 3) submit
  const submitRes = await fetch(`${base}/works/me/${workId}/submit`, {
    method: 'POST',
    headers: headersAuthOnly,
  });
  const submitBody = await readText(submitRes);
  console.log('submit_status =', submitRes.status);
  console.log('submit_response =', submitBody.text);

  // 4) list reviewing
  const listRes = await fetch(`${base}/works/me/list?status=reviewing`, {
    headers: headersAuthOnly,
  });
  const listBody = await readText(listRes);
  console.log('reviewing_list_status =', listRes.status);
  console.log('reviewing_list_response =', listBody.text);

  // 5) 如果列表为空，顺便拉一次全量 list（不带 status），看是不是 status 过滤问题
  const listAllRes = await fetch(`${base}/works/me/list`, {
    headers: headersAuthOnly,
  });
  const listAllBody = await readText(listAllRes);
  console.log('list_all_status =', listAllRes.status);
  console.log('list_all_response =', listAllBody.text);

  console.log('DONE');
}

main().catch((e) => {
  console.error('FATAL:', e);
  if (e && e.stack) console.error(e.stack);
  process.exit(1);
});

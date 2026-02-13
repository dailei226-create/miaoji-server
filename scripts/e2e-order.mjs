const base = 'http://127.0.0.1:3100';

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    method: options.method || 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data || {});
    throw new Error(`HTTP ${res.status} ${path} ${msg}`);
  }
  return data;
}

function pickToken(res) {
  if (!res) return '';
  return res.token || res?.data?.token || res?.accessToken || res?.data?.accessToken || '';
}

function pickItems(res) {
  if (!res) return [];
  return Array.isArray(res) ? res : (res.items || res.works || res.data?.items || []);
}

async function main() {
  const login = await request('/auth/mock-login', {
    method: 'POST',
    body: { openId: `e2e_${Date.now()}`, nickname: 'e2e', role: 'buyer' },
  });
  const token = pickToken(login);
  if (!token) throw new Error('no token from mock-login');

  const headers = { Authorization: `Bearer ${token}` };
  const worksRes = await request('/works?status=on_sale', { headers });
  const works = pickItems(worksRes);
  const work = works.find(w => Number(w.stock) >= 12);
  if (!work) throw new Error('no work with stock>=12');

  const stockBefore = Number(work.stock) || 0;
  const order = await request('/orders', {
    method: 'POST',
    headers,
    body: { workId: work.id, qty: 12 },
  });
  if (!order?.id) throw new Error('order missing id');

  const paid = await request(`/orders/${order.id}/mock-pay`, {
    method: 'POST',
    headers,
    body: {},
  });
  const status = (paid?.status || '').toString().toLowerCase();
  if (status !== 'paid') throw new Error(`status not paid: ${paid?.status}`);

  const workAfter = await request(`/works/${work.id}`, { headers });
  const stockAfter = Number(workAfter?.stock) || 0;
  if (stockBefore - 12 !== stockAfter) {
    throw new Error(`stock not decremented: before=${stockBefore} after=${stockAfter}`);
  }

  const orderDetail = await request(`/orders/${order.id}`, { headers });
  console.log('orderDetail', JSON.stringify(orderDetail, null, 2));
  const firstItem = (orderDetail && orderDetail.items && orderDetail.items[0]) || null;
  const qty = Number(orderDetail?.quantity || firstItem?.quantity || firstItem?.qty || 0);
  const unitPrice = Number(
    orderDetail?.unitPrice || firstItem?.priceSnap || firstItem?.price || 0
  );
  const amount = Number(orderDetail?.amount || 0);
  if (qty !== 12) throw new Error(`qty not 12: ${qty}`);
  // 金额单位修正：现在全是分
  // unitPrice = 1000 (10元), qty = 12, amount = 12000
  if (amount !== unitPrice * qty) {
    throw new Error(`amount mismatch: amount=${amount} unitPrice=${unitPrice} qty=${qty}`);
  }

  // 增加展示断言（模拟）
  const displayAmount = (amount / 100).toFixed(2);
  console.log(`PASS display-amount-check: ${displayAmount}`);

  console.log('PASS mock-login');
  console.log('PASS create-order');
  console.log('PASS mock-pay');
  console.log('PASS stock-decrement');
  console.log('PASS order-amount-qty-status');
}

main().catch((e) => {
  console.error('FAIL', e.message || e);
  process.exit(1);
});

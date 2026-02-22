/**
 * QA 端到端流程测试
 * 基于规范文档验证三端流程
 */

const http = require('http');

const BASE = 'http://localhost:3100';
let BUYER_TOKEN = '';
let CREATOR_TOKEN = '';
let ADMIN_TOKEN = '';
let BUYER_ID = '';
let CREATOR_ID = '';

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
        resolve({ status: res.statusCode, data: json, raw: data.slice(0, 500) });
      });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function ok(cond, msg) {
  console.log(cond ? `  [PASS] ${msg}` : `  [FAIL] ${msg}`);
  return cond;
}

async function main() {
  console.log('='.repeat(70));
  console.log('C. 三端流程端到端测试');
  console.log('='.repeat(70));

  // 获取 Tokens
  const r1 = await request('POST', '/auth/mock-login', { openId: 'e2e_buyer_001', nickname: 'E2EBuyer', role: 'buyer' });
  BUYER_TOKEN = r1.data?.token; BUYER_ID = r1.data?.user?.id;
  const r2 = await request('POST', '/auth/mock-login', { openId: 'e2e_creator_001', nickname: 'E2ECreator', role: 'creator' });
  CREATOR_TOKEN = r2.data?.token; CREATOR_ID = r2.data?.user?.id;
  const r3 = await request('POST', '/auth/mock-login', { openId: 'e2e_admin_001', nickname: 'E2EAdmin', role: 'admin' });
  ADMIN_TOKEN = r3.data?.token;

  console.log(`Buyer: ${BUYER_ID}, Creator: ${CREATOR_ID}`);

  // ========== C.1 买家主流程 ==========
  console.log('\n--- C.1 买家主流程：浏览→详情→登录→结算→下单 ---');

  // 1) 浏览商品列表
  const works = await request('GET', '/works');
  ok(works.status === 200 && works.data?.items?.length > 0, `GET /works: ${works.data?.items?.length || 0} 件作品`);

  // 2) 获取一个 on_sale 状态的作品
  let onSaleWork = works.data?.items?.find(w => w.status === 'on_sale' || w.status === 'online');
  if (!onSaleWork && works.data?.items?.length > 0) onSaleWork = works.data.items[0];
  
  if (onSaleWork) {
    console.log(`  选取作品: id=${onSaleWork.id}, status=${onSaleWork.status}, price=${onSaleWork.price}`);
    
    // 3) 获取作品详情
    const detail = await request('GET', `/works/${onSaleWork.id}`);
    ok(detail.status === 200, `GET /works/:id 详情页: ${detail.status}`);

    // 4) 获取/创建地址
    const addrs = await request('GET', '/addresses', null, BUYER_TOKEN);
    let addrId = addrs.data?.[0]?.id;
    if (!addrId) {
      const newAddr = await request('POST', '/addresses', {
        name: 'E2E Test', phone: '13800138000', province: 'ZJ', city: 'HZ', district: 'XH', detail: 'Test 100', isDefault: true
      }, BUYER_TOKEN);
      addrId = newAddr.data?.id;
      ok(newAddr.status === 201 || newAddr.status === 200, `POST /addresses 创建地址: ${newAddr.status}`);
    }

    // 5) 创建订单
    if (addrId) {
      const order = await request('POST', '/orders', {
        workId: onSaleWork.id, qty: 1, addressId: addrId
      }, BUYER_TOKEN);
      ok(order.status === 201 || order.status === 200, `POST /orders 创建订单: ${order.status}`);
      if (order.data?.id) {
        console.log(`  订单创建成功: id=${order.data.id}, status=${order.data.status}`);
        
        // 6) 获取订单详情
        const orderDetail = await request('GET', `/orders/${order.data.id}`, null, BUYER_TOKEN);
        ok(orderDetail.status === 200, `GET /orders/:id 订单详情: ${orderDetail.status}`);
      } else {
        console.log(`  订单创建失败: ${order.raw}`);
      }
    }
  } else {
    console.log('  [SKIP] 没有可用作品');
  }

  // ========== C.2 买家辅助流程 ==========
  console.log('\n--- C.2 买家辅助流程：收藏/关注/地址/售后 ---');

  // 收藏
  if (onSaleWork) {
    const fav = await request('POST', '/favorites', { workId: onSaleWork.id }, BUYER_TOKEN);
    ok(fav.status === 201 || fav.status === 200 || fav.status === 409, `POST /favorites 收藏: ${fav.status}`);
    
    const favList = await request('GET', '/favorites', null, BUYER_TOKEN);
    ok(favList.status === 200, `GET /favorites 收藏列表: ${favList.status}`);
  }

  // 关注
  const follow = await request('POST', '/follows', { creatorId: CREATOR_ID }, BUYER_TOKEN);
  ok(follow.status === 201 || follow.status === 200 || follow.status === 409, `POST /follows 关注: ${follow.status}`);
  
  const followList = await request('GET', '/follows', null, BUYER_TOKEN);
  ok(followList.status === 200, `GET /follows 关注列表: ${followList.status}`);

  // 地址管理
  const addrList = await request('GET', '/addresses', null, BUYER_TOKEN);
  ok(addrList.status === 200, `GET /addresses 地址列表: ${addrList.status}`);

  // 售后入口
  const orders = await request('GET', '/orders', null, BUYER_TOKEN);
  if (orders.data?.length > 0) {
    const orderId = orders.data[0].id;
    const afterSale = await request('POST', `/orders/${orderId}/after-sale`, { type: 'refund', reason: 'test' }, BUYER_TOKEN);
    console.log(`  POST /orders/:id/after-sale 售后申请: ${afterSale.status} (${afterSale.status === 400 ? '状态不允许/参数错误' : afterSale.status === 200 ? '成功' : '其他'})`);
  }

  // ========== C.3 创作者申请流程 ==========
  console.log('\n--- C.3 创作者申请流程：none→apply→pending→approved ---');

  // 检查当前状态
  const me = await request('GET', '/me', null, BUYER_TOKEN);
  console.log(`  当前 creatorStatus: ${me.data?.creatorStatus}`);

  // 申请创作者
  const apply = await request('POST', '/creators/apply', {
    phone: '13800138001', realName: 'E2E Creator', intro: 'Test intro', isOriginal: true
  }, BUYER_TOKEN);
  ok(apply.status === 201 || apply.status === 200 || apply.status === 400, `POST /creators/apply 申请: ${apply.status}`);

  // 再次检查状态
  const me2 = await request('GET', '/me', null, BUYER_TOKEN);
  console.log(`  申请后 creatorStatus: ${me2.data?.creatorStatus}`);

  // ========== C.4 创作者作品流 ==========
  console.log('\n--- C.4 创作者作品流：发布→审核→上架 ---');

  // 检查创作者的作品列表
  const myWorks = await request('GET', '/works/me/list', null, CREATOR_TOKEN);
  ok(myWorks.status === 200, `GET /works/me/list 我的作品: ${myWorks.status}, count=${myWorks.data?.length || 0}`);

  // 创建草稿
  const draft = await request('POST', '/works/me/draft', {
    title: 'E2E Test Work', price: 100, stock: 10
  }, CREATOR_TOKEN);
  ok(draft.status === 201 || draft.status === 200, `POST /works/me/draft 保存草稿: ${draft.status}`);
  
  if (draft.data?.id) {
    console.log(`  草稿创建成功: id=${draft.data.id}`);
    
    // 提交审核
    const submit = await request('POST', `/works/me/${draft.data.id}/submit`, {}, CREATOR_TOKEN);
    ok(submit.status === 200 || submit.status === 201, `POST /works/me/:id/submit 提交审核: ${submit.status}`);
  }

  // ========== C.5 卖家订单流 ==========
  console.log('\n--- C.5 卖家订单流：卖家订单列表→发货 ---');

  const sellerOrders = await request('GET', '/orders/seller', null, CREATOR_TOKEN);
  ok(sellerOrders.status === 200, `GET /orders/seller 卖家订单: ${sellerOrders.status}, count=${sellerOrders.data?.items?.length || sellerOrders.data?.length || 0}`);

  // 尝试发货
  if (sellerOrders.data?.items?.length > 0 || sellerOrders.data?.length > 0) {
    const items = sellerOrders.data?.items || sellerOrders.data;
    const paidOrder = items.find(o => o.status === 'paid');
    if (paidOrder) {
      const ship = await request('POST', `/orders/${paidOrder.id}/ship`, {
        expressCompany: 'SF', expressNo: 'SF1234567890'
      }, CREATOR_TOKEN);
      ok(ship.status === 200, `POST /orders/:id/ship 发货: ${ship.status}`);
    } else {
      console.log('  [SKIP] 没有待发货订单');
    }
  }

  // ========== C.6 管理员后台 ==========
  console.log('\n--- C.6 管理员后台：创作者审核/作品审核/订单监控 ---');

  // 创作者列表
  const creators = await request('GET', '/admin/creators', null, ADMIN_TOKEN);
  ok(creators.status === 200, `GET /admin/creators 创作者列表: ${creators.status}`);

  // 作品审核列表
  const worksReview = await request('GET', '/admin/works', null, ADMIN_TOKEN);
  ok(worksReview.status === 200, `GET /admin/works 作品列表: ${worksReview.status}`);

  // 订单监控
  const ordersAdmin = await request('GET', '/admin/orders', null, ADMIN_TOKEN);
  ok(ordersAdmin.status === 200, `GET /admin/orders 订单监控: ${ordersAdmin.status}`);

  // ========== D. 状态机与权限边界验证 ==========
  console.log('\n' + '='.repeat(70));
  console.log('D. 状态机与权限边界验证');
  console.log('='.repeat(70));

  // D.1 非 ON_SALE 不可下单
  console.log('\n--- D.1 非 ON_SALE 不可下单 ---');
  const offlineWork = works.data?.items?.find(w => w.status === 'offline' || w.status === 'off_shelf');
  if (offlineWork) {
    const addrList2 = await request('GET', '/addresses', null, BUYER_TOKEN);
    const addrId2 = addrList2.data?.[0]?.id;
    if (addrId2) {
      const badOrder = await request('POST', '/orders', { workId: offlineWork.id, qty: 1, addressId: addrId2 }, BUYER_TOKEN);
      ok(badOrder.status === 400 || badOrder.status === 404, `下架作品下单应失败: ${badOrder.status} (${badOrder.data?.message || ''})`);
    }
  } else {
    console.log('  [SKIP] 没有下架作品可测试');
  }

  // D.2 库存<=0不可下单
  console.log('\n--- D.2 库存<=0不可下单 ---');
  const soldOutWork = works.data?.items?.find(w => w.stock === 0 || w.status === 'sold_out');
  if (soldOutWork) {
    const addrList3 = await request('GET', '/addresses', null, BUYER_TOKEN);
    const addrId3 = addrList3.data?.[0]?.id;
    if (addrId3) {
      const badOrder2 = await request('POST', '/orders', { workId: soldOutWork.id, qty: 1, addressId: addrId3 }, BUYER_TOKEN);
      ok(badOrder2.status === 400, `售罄作品下单应失败: ${badOrder2.status}`);
    }
  } else {
    console.log('  [SKIP] 没有售罄作品可测试');
  }

  // D.3 订单列表必须 role 过滤
  console.log('\n--- D.3 订单列表 role 过滤验证 ---');
  const buyerOrders = await request('GET', '/orders', null, BUYER_TOKEN);
  const sellerOrders2 = await request('GET', '/orders/seller', null, BUYER_TOKEN);
  console.log(`  买家订单 /orders: ${buyerOrders.status}, count=${buyerOrders.data?.length || 0}`);
  console.log(`  卖家订单 /orders/seller (用买家token): ${sellerOrders2.status} (应为空或仅自己卖的)`);

  console.log('\n' + '='.repeat(70));
  console.log('测试完成');
  console.log('='.repeat(70));
}

main().catch(console.error);

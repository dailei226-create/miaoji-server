# 妙集服务器同步前环境缺口体检报告

**生成时间**: 2026-02-13 22:45  
**项目版本**: backup-20260214  
**检测范围**: miaoji-server (后端) + app_clean_v3 (小程序) + admin-web (管理后台)

---

## A. 总结结论

### ❌ 暂不建议立即同步到服务器

**核心理由：**

1. **微信支付配置缺失**：`.env.example` 未包含 `WXPAY_*` 和 `WX_APP_SECRET` 等必需变量，服务启动会直接崩溃
2. **Seed 数据不完整**：当前 seed 只创建基础用户和空作品，缺少「已通过创作者 + 上架作品」可验证全流程数据
3. **生产环境 API 地址未配置**：小程序 `api.js` 硬编码 `https://moji.yanxiangtaoci.cn`，需确认 DNS/SSL 已就绪

---

## B. 缺口清单（按风险分级）

### 🔴 阻塞级（必须修复才能部署）

| # | 缺口描述 | 影响 | 定位 |
|---|---------|------|------|
| 1 | `.env` 缺少微信支付配置 | 服务启动报错 `微信支付配置缺失` | `pay.service.ts:56-68` |
| 2 | 缺少 `WX_APP_SECRET` | 真实登录/支付无法换取 openid | `pay.service.ts:78-88` |
| 3 | `WXPAY_MERCHANT_KEY_PATH` 指向的私钥文件不存在 | 服务启动崩溃 | `pay.service.ts:66` |
| 4 | 生产环境 `CORS_ORIGIN` 需更新 | admin-web 跨域被拒 | `.env.example:14` |

### 🟠 高风险（影响核心流程）

| # | 缺口描述 | 影响 | 定位 |
|---|---------|------|------|
| 5 | 小程序真实登录未测试 | 开发环境用 mock-login，生产环境需 `wx.login` | `auth.js` |
| 6 | `/pay/notify` 回调未验签 | 微信支付回调可能被伪造 | 需补充 |
| 7 | 订单超时未自动取消 | 库存锁定不释放 | 需补充定时任务 |
| 8 | 退款接口只改状态，未调微信退款API | 用户无法实际收到退款 | `orders.service.ts` |
| 9 | Prisma migrations 未在生产运行 | 表结构不一致 | 需 `npx prisma migrate deploy` |

### 🟡 低风险（体验/运维问题）

| # | 缺口描述 | 影响 | 定位 |
|---|---------|------|------|
| 10 | seed 数据无可验证创作者 | 无法快速验证全流程 | `prisma/seed.ts` |
| 11 | admin-web 缺少 `.env.production` | 部署后 API 地址为空 | `admin-web/vite.config.js` |
| 12 | 客服消息无推送通知 | 用户不知有新消息 | 未实现 |
| 13 | 缺少操作日志/审计日志查看界面 | 运营无法追溯 | admin-web |

---

## C. 接口对照表

### C.1 后端已实现接口（从代码扫描）

| 模块 | 路径 | 方法 | 状态 | 备注 |
|------|------|------|------|------|
| **认证** | `/auth/mock-login` | POST | ✅ 仅开发 | 生产环境返回 403 |
| | `/me` | GET | ✅ | 返回 creatorStatus/isCreator |
| | `/me` | PATCH | ✅ | 更新昵称/简介 |
| | `/me/notices` | GET | ✅ | 站内信列表 |
| | `/me/notices/unread-count` | GET | ✅ | |
| | `/me/notices/:id/read` | PATCH | ✅ | |
| | `/me/payout` | GET/PUT | ✅ | 创作者收款账号 |
| **作品** | `/works` | GET | ✅ | 公开列表（含筛选） |
| | `/works/:id` | GET | ✅ | 作品详情 |
| | `/works/me/list` | GET | ✅ | 我的作品 |
| | `/works/me/:id` | GET | ✅ | |
| | `/works/me/draft` | POST | ✅ | 保存草稿 |
| | `/works/me/:id/submit` | POST | ✅ | 提交审核 |
| | `/works/me/:id` | DELETE | ✅ | |
| | `/works/me/:id/discount` | PUT | ✅ | 设置折扣 |
| | `/works/me/:id/price` | PUT | ✅ | 修改价格 |
| **订单** | `/orders` | POST | ✅ | 创建订单 |
| | `/orders` | GET | ✅ | 买家订单列表 |
| | `/orders/seller` | GET | ✅ | 卖家订单列表 |
| | `/orders/:id` | GET | ✅ | 订单详情 |
| | `/orders/:id/cancel` | POST | ✅ | 取消订单 |
| | `/orders/:id/ship` | POST | ✅ | 发货 |
| | `/orders/:id/confirm-receipt` | POST | ✅ | 确认收货 |
| | `/orders/:id/after-sale` | POST | ✅ | 申请售后 |
| | `/orders/:id/request-refund` | POST | ✅ | 申请退款 |
| | `/orders/mock-pay` | POST | ⚠️ 仅开发 | 生产返回 403 |
| **支付** | `/pay/prepay` | POST | ✅ | 发起微信支付 |
| | `/pay/notify` | POST | ⚠️ 待验签 | 微信回调 |
| **收藏/关注** | `/favorites` | GET/POST/DELETE | ✅ | |
| | `/follows` | GET/POST/DELETE | ✅ | |
| **地址** | `/addresses` | GET/POST/DELETE | ✅ | |
| | `/addresses/:id/default` | POST | ✅ | |
| **创作者** | `/creators/apply` | POST | ✅ | 申请成为创作者 |
| **活动** | `/creator/activity/current` | GET | ✅ | 当前活动 |
| | `/creator/activity/join` | POST/DELETE | ✅ | 参加/退出活动 |
| **Banner/分类** | `/banners` | GET | ✅ | |
| | `/config` | GET | ✅ | 运营配置 |
| **客服** | `/support/tickets` | POST | ✅ | 创建工单 |
| | `/support/tickets/me` | GET | ✅ | 我的工单 |
| | `/support/tickets/:id/messages` | GET/POST | ✅ | |
| **管理后台** | `/admin/creators/*` | 多个 | ✅ | 创作者审核/冻结/解封 |
| | `/admin/works/*` | 多个 | ✅ | 作品审核/上下架 |
| | `/admin/orders/*` | 多个 | ✅ | 订单管理/退款处理 |
| | `/admin/banners/*` | 多个 | ✅ | Banner管理 |
| | `/admin/categories/*` | 多个 | ✅ | 分类管理 |
| | `/admin/activities/*` | 多个 | ✅ | 活动管理 |
| | `/admin/support/*` | 多个 | ✅ | 客服管理 |

### C.2 可能缺失的接口

| 功能 | 期望路径 | 现状 |
|------|---------|------|
| 用户真实登录 | `POST /auth/login` (微信登录) | ❌ 未实现，仅有 mock-login |
| 微信退款API调用 | `/pay/refund` 或集成到 orders | ⚠️ 只改状态，未调微信 |
| 图片上传 | `POST /upload` | ✅ 已有 |

---

## D. 状态机一致性检查

### D.1 作品状态 (WorkStatus)

**Prisma 定义**:
```
enum WorkStatus {
  draft      // 草稿
  reviewing  // 审核中
  online     // 上架（前端显示 on_sale）
  offline    // 下架
  sold_out   // 售罄
}
```

**前后端映射** (`works.service.ts:19-28`):
- `online` → 前端显示 `on_sale` ✅
- `reviewing` → `reviewing` ✅
- `draft` → `draft` ✅
- `rejected` → 映射为 `offline` ✅
- `sold_out` → `sold_out` ✅

**⚠️ 风险点**: 文档提到的 `off_shelf` 在代码中实际是 `offline`，需确认一致。

### D.2 订单状态 (OrderStatus)

**Prisma 定义**:
```
enum OrderStatus {
  created           // 已创建（待支付）
  paid              // 已支付（待发货）
  paid_mock         // 模拟支付
  shipped           // 已发货（待收货）
  received          // 已确认收货
  completed         // 已完成
  canceled          // 已取消
  refund_requested  // 退款申请中
  refund_approved   // 退款已批准
  refund_rejected   // 退款已拒绝
  refunded          // 已退款
}
```

**状态流转验证**:
- `created` → `paid` (支付成功) ✅
- `created` → `canceled` (取消订单) ✅
- `paid` → `shipped` (发货) ✅
- `paid` → `refund_requested` (申请退款) ✅
- `shipped` → `received` (确认收货) ✅
- `refund_requested` → `refund_approved`/`refund_rejected` ✅

**⚠️ 风险点**: `paid_mock` 状态在生产环境不应出现。

### D.3 创作者状态 (CreatorStatus)

**Prisma 定义**:
```
enum CreatorStatus {
  pending   // 待审核
  approved  // 已通过
  rejected  // 已拒绝
  frozen    // 已冻结
  banned    // 已封禁
}
```

**前端适配** (`auth.js` 归一化):
- 统一转小写 ✅
- `isCreator = creatorStatus === 'approved'` ✅
- `frozen` 会显示"已冻结"提示 ✅

---

## E. 环境变量检查

### E.1 当前 `.env.example` 内容

```
PORT=3100
NODE_ENV=development
DATABASE_URL="mysql://..."
JWT_SECRET="..."
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173"
```

### E.2 必须补充的变量

```bash
# 微信支付（必填）
WXPAY_APPID=wx...            # 小程序AppID
WXPAY_MCHID=...              # 商户号
WXPAY_MERCHANT_SERIAL=...    # 商户证书序列号
WXPAY_NOTIFY_URL=https://your-domain.com/pay/notify
WXPAY_MERCHANT_KEY_PATH=./certs/apiclient_key.pem

# 小程序登录（必填，用于换取openid）
WX_APP_SECRET=...

# 生产环境 CORS
CORS_ORIGIN=https://your-admin-domain.com
```

---

## F. 可执行测试脚本

### F.1 冒烟测试（PowerShell）

复制以下命令在 PowerShell 执行：

```powershell
# 1. 获取测试 Token（仅开发环境）
$body = '{"openId":"test_buyer_001","nickname":"TestBuyer","role":"buyer"}'
$res = Invoke-RestMethod -Uri "http://localhost:3100/auth/mock-login" -Method POST -Body $body -ContentType "application/json"
$token = $res.token
Write-Host "Token: $token"

# 2. 测试 GET /me
$me = Invoke-RestMethod -Uri "http://localhost:3100/me" -Method GET -Headers @{Authorization="Bearer $token"}
Write-Host "User ID: $($me.id), CreatorStatus: $($me.creatorStatus)"

# 3. 测试 GET /works
$works = Invoke-RestMethod -Uri "http://localhost:3100/works" -Method GET
Write-Host "Works count: $($works.items.Count)"

# 4. 测试 GET /config
$cfg = Invoke-RestMethod -Uri "http://localhost:3100/config" -Method GET
Write-Host "Config loaded: $($cfg.marketCategories.Count) categories"

# 5. 测试 GET /banners
$banners = Invoke-RestMethod -Uri "http://localhost:3100/banners" -Method GET
Write-Host "Banners count: $($banners.Count)"

# 6. 测试 GET /favorites
$favs = Invoke-RestMethod -Uri "http://localhost:3100/favorites" -Method GET -Headers @{Authorization="Bearer $token"}
Write-Host "Favorites: $($favs.items.Count)"
```

### F.2 订单流程测试

```powershell
# 需要先有一个 online 状态的作品和一个地址

# 创建地址
$addrBody = '{"name":"Test","phone":"13800138000","province":"ZJ","city":"HZ","district":"XH","detail":"Test 100","isDefault":true}'
$addr = Invoke-RestMethod -Uri "http://localhost:3100/addresses" -Method POST -Body $addrBody -ContentType "application/json" -Headers @{Authorization="Bearer $token"}
Write-Host "Address ID: $($addr.id)"

# 获取一个在售作品
$works = Invoke-RestMethod -Uri "http://localhost:3100/works?status=on_sale" -Method GET
$workId = $works.items[0].id
Write-Host "Work ID: $workId"

# 创建订单
$orderBody = "{`"workId`":`"$workId`",`"qty`":1,`"addressId`":`"$($addr.id)`"}"
$order = Invoke-RestMethod -Uri "http://localhost:3100/orders" -Method POST -Body $orderBody -ContentType "application/json" -Headers @{Authorization="Bearer $token"}
Write-Host "Order ID: $($order.id), Status: $($order.status)"
```

---

## G. 最小修复建议

### G.1 阻塞级修复

| # | 修复内容 | 改动文件 | 风险 |
|---|---------|----------|------|
| 1 | 补充 `.env` 微信支付配置 | `.env`, `.env.example` | 低 |
| 2 | 上传商户私钥到 `certs/` | 新建 `certs/apiclient_key.pem` | 需保密 |
| 3 | 更新 `CORS_ORIGIN` | `.env` | 低 |

### G.2 部署前必做

| # | 操作 | 命令 |
|---|------|------|
| 1 | 运行数据库迁移 | `npx prisma migrate deploy` |
| 2 | 运行 seed（可选） | `RUN_SEED=true npx prisma db seed` |
| 3 | 构建项目 | `npm run build` |
| 4 | 设置 NODE_ENV | `NODE_ENV=production` |

### G.3 高风险项修复建议

| # | 问题 | 建议 | 改动量 |
|---|------|------|--------|
| 1 | 真实登录 | 补充 `POST /auth/login` 接口，接收 `wx.login` 的 code | 中 |
| 2 | 支付回调验签 | 在 `/pay/notify` 中验证微信签名 | 中 |
| 3 | 微信退款 | 实现真实退款API调用 | 高 |
| 4 | 订单超时 | 增加定时任务或懒检查 | 中 |

---

## H. Prisma Migrations 状态

已有迁移（按时间顺序）：
1. `20260201061014_init` - 初始化
2. `20260206040000_add_order_payment_fields` - 订单支付字段
3. `20260206043000_add_banners` - Banner表
4. `20260206050000_add_work_weight` - 作品权重
5. `20260206053000_add_activities` - 活动表
6. `20260206060000_add_work_discount` - 作品折扣
7. `20260207000000_add_work_stock` - 库存字段
8. `20260208000000_activity_config_fields` - 活动配置
9. `20260208000000_add_order_management` - 订单管理
10. `20260208100000_market_categories` - 集市分类
11. `20260208110000_add_user_bio` - 用户简介
12. `20260209000000_add_activity_join` - 活动参加
13. `20260211000000_add_creator_management` - 创作者管理
14. `20260212000000_add_creator_apply_data` - 创作者申请数据
15. `20260212010000_add_creator_payout` - 创作者收款
16. `20260212020000_add_received_status` - 收货状态

**部署命令**: `npx prisma migrate deploy`

---

## I. 下一步行动

### 你需要做的（1-2件事）：

1. **提供微信支付配置信息**：
   - 小程序 AppID 和 AppSecret
   - 商户号、商户证书序列号
   - 商户私钥文件（apiclient_key.pem）
   - 支付回调地址（需公网可访问）

2. **确认生产域名**：
   - API 域名（如 `api.yanxiangtaoci.cn`）是否已解析
   - SSL 证书是否已配置
   - admin-web 部署地址

### 我可以帮你做的：

- 补充 `.env.example` 完整模板
- 增强 seed 数据（含创作者+作品）
- 补充真实登录接口
- 补充支付回调验签

---

**报告结束**

> 如需详细检查某个模块，请告诉我具体模块名称。

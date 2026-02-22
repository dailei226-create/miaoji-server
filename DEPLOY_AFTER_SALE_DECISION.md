# 发布者售后处理接口部署清单

## ⚠️ 前置：本地需先提交并推送

**当前 orders 修改尚未提交。** 服务器 `git pull` 前，在本机执行：

```bash
cd miaoji-server
git add src/modules/orders/orders.controller.ts src/modules/orders/orders.service.ts
git commit -m "feat: POST /orders/:id/after-sale/decision 发布者售后处理接口"
git push
```

---

## 0) 核验证据（已确认）

```bash
curl -i -X POST "https://moji.yanxiangtaoci.cn/orders/test/after-sale/decision"
```

**当前输出（2026-02-20）：**
```
HTTP/1.1 404 Not Found
{"message":"Cannot POST /orders/test/after-sale/decision","error":"Not Found","statusCode":404}
```

---

## 1) 服务器：定位后端目录 + pm2 进程

```bash
pm2 ls
pm2 describe miaoji-server 2>/dev/null || true
ls -la
pwd
```

**目标：** 找到包含 `package.json` / `src` / `prisma` 的后端目录，确认 pm2 进程名（如非 miaoji-server 则用实际名替换后续命令中的进程名）

---

## 2) 拉取最新代码 + 确认路由已存在

```bash
cd /path/to/miaoji-server   # 替换为实际目录
git status
git log -n 3 --oneline
git pull
```

**代码校验（必须命中）：**
```bash
rg "after-sale/decision|after_sale_seller_decision" -n src || grep -r "after-sale/decision" -n src
```

**期望：**
- `src/modules/orders/orders.controller.ts` 含 `@Post(':id/after-sale/decision')`
- `src/modules/orders/orders.service.ts` 含 `afterSaleSellerDecision` 和 `after_sale_seller_decision`

---

## 3) 安装依赖 + 构建

```bash
npm ci || npm i
npm run build
```

如使用 pnpm：
```bash
pnpm i
pnpm build
```

---

## 4) 重启 pm2

```bash
pm2 describe <进程名>   # 确认启动命令
pm2 reload <进程名> || pm2 restart <进程名>
pm2 logs <进程名> --lines 120
```

---

## 5) 线上验收：路由已注册

```bash
curl -i -X POST "https://moji.yanxiangtaoci.cn/orders/test/after-sale/decision"
```

**期望：**
- 不再返回 `"Cannot POST /orders/..."`
- 返回 **401**（需登录）或 **400**（参数错误）均视为路由已注册，部署成功

**若仍 404：** 说明部署未覆盖线上正在跑的那份代码（目录/pm2 进程不对）

---

## 6) 业务验收（小程序）

1. 小程序开发者工具 → Network
2. 重试「拒绝申请」或「同意退货」
3. 应看到 `POST /orders/<真实id>/after-sale/decision`，`statusCode: 200`，`resp: { ok: true }`
4. admin-web 售后详情应显示「发布者处理意见」

**若 curl 已 401/400 但小程序仍 404：** 检查 `utils/api.js` 的 baseUrl 是否指向同一域名

---

## 7) 快速排障结论

| 现象 | 结论 |
|------|------|
| curl 仍 404 | 部署未覆盖线上代码：检查 pm2 工作目录、是否多实例、nginx 转发 |
| curl 401/400，小程序 404 | 小程序 baseUrl 或环境指向错误 |
| 小程序 200，后台看不到 | 检查 orders.service 是否返回 `afterSaleSellerDecision` 字段 |

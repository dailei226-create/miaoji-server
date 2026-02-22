# 妙集服务器环境体检报告

**生成时间**：______（执行命令后填写）  
**执行人**：______  
**服务器**：______

---

## 命令执行指南

> **重要**：以下命令全部为**只读命令**，不会修改任何文件。请按顺序复制到服务器终端执行，将输出结果粘贴到对应区域。

---

## A. 服务器基础信息

### 命令 A1：系统信息
```bash
echo "=== 时间 ===" && date
echo "=== 主机名 ===" && hostname
echo "=== Node 版本 ===" && node -v
echo "=== npm 版本 ===" && npm -v
echo "=== PM2 版本 ===" && pm2 -v
```

**预期输出示例**：
```
=== 时间 ===
Sat Feb 14 15:30:00 CST 2026
=== 主机名 ===
miaoji-server
=== Node 版本 ===
v18.17.0
...
```

**你的输出**：
```
（粘贴到这里）
```

---

## B. 服务端口与健康检查

### 命令 B1：PM2 进程列表
```bash
pm2 list
```

**预期输出**：显示所有 PM2 管理的进程，包括 name、status、CPU、memory

**你的输出**：
```
（粘贴到这里）
```

### 命令 B2：端口监听情况
```bash
netstat -tlnp 2>/dev/null | grep -E "3100|3000|80|443" || ss -tlnp | grep -E "3100|3000|80|443"
```

**预期输出**：显示监听 3100/3000/80/443 端口的进程

**你的输出**：
```
（粘贴到这里）
```

### 命令 B3：健康检查
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/health && echo " /health"
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/ && echo " /"
```

**预期输出**：`200 /health` 和 `200 /`（或 `404` 等状态码）

**你的输出**：
```
（粘贴到这里）
```

---

## C. 环境变量清单

### 命令 C1：列出 .env 变量名（敏感值打码）
```bash
cd /www/miaoji-server && cat .env 2>/dev/null | while read line; do
  if [[ "$line" =~ ^# ]] || [[ -z "$line" ]]; then
    echo "$line"
  else
    key=$(echo "$line" | cut -d= -f1)
    val=$(echo "$line" | cut -d= -f2-)
    if [[ "$key" =~ (SECRET|PASSWORD|KEY|TOKEN|APPID) ]]; then
      echo "$key=****"
    elif [[ -n "$val" ]]; then
      echo "$key=(有值)"
    else
      echo "$key=(空)"
    fi
  fi
done
```

> **注意**：如果项目路径不是 `/www/miaoji-server`，请替换为实际路径。

**你的输出**：
```
（粘贴到这里）
```

---

## D. Prisma 迁移与 Schema 版本

### 命令 D1：迁移文件列表
```bash
cd /www/miaoji-server && ls -la prisma/migrations/ 2>/dev/null | head -20
```

**预期输出**：显示 migrations 目录下的文件夹列表

**你的输出**：
```
（粘贴到这里）
```

### 命令 D2：迁移部署状态
```bash
cd /www/miaoji-server && npx prisma migrate status 2>&1 | head -30
```

**预期输出**：显示哪些迁移已应用、哪些待应用

**你的输出**：
```
（粘贴到这里）
```

---

## E. 数据库结构快照

### 命令 E1：表名列表
```bash
mysql -u miaoji -p -e "USE miaoji; SHOW TABLES;" 2>/dev/null
```

> **提示**：执行后会提示输入密码，输入数据库密码后回车。

**你的输出**：
```
（粘贴到这里）
```

### 命令 E2：Order 表结构
```bash
mysql -u miaoji -p -e "USE miaoji; DESCRIBE \`Order\`;" 2>/dev/null
```

**你的输出**：
```
（粘贴到这里）
```

### 命令 E3：Work 表结构
```bash
mysql -u miaoji -p -e "USE miaoji; DESCRIBE Work;" 2>/dev/null
```

**你的输出**：
```
（粘贴到这里）
```

### 命令 E4：User 表结构
```bash
mysql -u miaoji -p -e "USE miaoji; DESCRIBE User;" 2>/dev/null
```

**你的输出**：
```
（粘贴到这里）
```

---

## F. 反代与域名（Nginx）

### 命令 F1：Nginx 配置文件位置
```bash
nginx -t 2>&1 | head -5
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || ls -la /etc/nginx/conf.d/ 2>/dev/null
```

**你的输出**：
```
（粘贴到这里）
```

### 命令 F2：Nginx 配置摘要（server_name + location）
```bash
grep -r "server_name\|location\|proxy_pass" /etc/nginx/sites-enabled/ 2>/dev/null | head -30
```

> 如果路径不存在，改用：
```bash
grep -r "server_name\|location\|proxy_pass" /etc/nginx/conf.d/ 2>/dev/null | head -30
```

**你的输出**：
```
（粘贴到这里）
```

---

## G. 文件与证书

### 命令 G1：上传目录检查
```bash
ls -la /www/miaoji-server/uploads 2>/dev/null || echo "uploads 目录不存在"
ls -la /www/miaoji-server/public 2>/dev/null || echo "public 目录不存在"
```

**你的输出**：
```
（粘贴到这里）
```

### 命令 G2：微信支付证书检查（只检查存在性）
```bash
ls -la /www/miaoji-server/certs/*.pem 2>/dev/null && echo "证书文件存在" || echo "证书文件不存在"
ls -la /www/miaoji-server/certs/*.p12 2>/dev/null && echo "P12证书存在" || echo "P12证书不存在"
```

**你的输出**：
```
（粘贴到这里）
```

### 命令 G3：SSL 证书检查（HTTPS）
```bash
ls -la /etc/letsencrypt/live/ 2>/dev/null | head -10
```

**你的输出**：
```
（粘贴到这里）
```

---

## H. 风险项清单

> 根据以上输出，整理出需要关注的问题。

### 阻塞级（必须解决才能上线）

| # | 问题 | 证据 | 建议 |
|---|------|------|------|
| 1 | （示例）数据库无法连接 | mysql 命令报错 | 检查 DATABASE_URL |

### 高风险

| # | 问题 | 证据 | 建议 |
|---|------|------|------|

### 中风险

| # | 问题 | 证据 | 建议 |
|---|------|------|------|

### 低风险

| # | 问题 | 证据 | 建议 |
|---|------|------|------|

---

## 附：一键执行脚本（可选）

如果你想一次性执行所有命令，可以将以下内容保存为 `audit.sh` 并执行 `bash audit.sh`：

```bash
#!/bin/bash
# 服务器体检脚本 - 只读
echo "========== A. 基础信息 =========="
date && hostname && node -v && npm -v && pm2 -v

echo "========== B. PM2 进程 =========="
pm2 list

echo "========== B. 端口监听 =========="
netstat -tlnp 2>/dev/null | grep -E "3100|3000|80|443" || ss -tlnp | grep -E "3100|3000|80|443"

echo "========== B. 健康检查 =========="
curl -s -o /dev/null -w "%{http_code} /health\n" http://127.0.0.1:3100/health
curl -s -o /dev/null -w "%{http_code} /\n" http://127.0.0.1:3100/

echo "========== D. Prisma 迁移 =========="
cd /www/miaoji-server && ls prisma/migrations/ 2>/dev/null

echo "========== F. Nginx 配置 =========="
grep -r "server_name\|proxy_pass" /etc/nginx/sites-enabled/ 2>/dev/null | head -20

echo "========== G. 文件检查 =========="
ls -la /www/miaoji-server/certs/*.pem 2>/dev/null && echo "证书存在" || echo "证书不存在"

echo "========== 完成 =========="
```

---

**报告生成完毕，请按命令清单执行并填写结果。**

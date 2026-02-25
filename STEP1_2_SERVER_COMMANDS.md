# Step 1 & 2：服务器端执行命令（需在阿里云服务器上运行）

当前 Cursor 环境为本地 Windows，以下命令需你 SSH 到 miaoji-server 所在服务器后执行。

---

## Step 1：安装并启动 Redis

```bash
# 1. 查看系统
cat /etc/os-release

# 2. 安装 Redis（任选其一）

# Ubuntu/Debian:
sudo apt-get update
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# CentOS/RHEL:
# sudo yum install -y redis
# sudo systemctl enable redis
# sudo systemctl start redis

# 3. 验证
redis-server -v
redis-cli ping
# 必须输出: PONG

# 4. 确认端口监听
(ss -lntp | grep 6379) || (netstat -lntp | grep 6379) || true
```

---

## Step 2：写入环境变量

**需要配置的变量：**

| 变量名 | 用途 |
|--------|------|
| ALIYUN_ACCESS_KEY_ID | 阿里云 AccessKey ID |
| ALIYUN_ACCESS_KEY_SECRET | 阿里云 AccessKey Secret |
| ALIYUN_SMS_SIGN_NAME | 短信签名名称（控制台赠送签名） |
| ALIYUN_SMS_TEMPLATE_CODE | 短信模板 Code（如 100001） |
| REDIS_URL | Redis 连接，默认 redis://127.0.0.1:6379 |

**写入方式（任选其一）：**

### 方式 A：pm2 ecosystem（推荐，若用 pm2 启动）
编辑 `ecosystem.config.js` 或 `ecosystem.config.cjs`，在 `env` 中加入：
```js
env: {
  NODE_ENV: 'production',
  ALIYUN_ACCESS_KEY_ID: '你的值',
  ALIYUN_ACCESS_KEY_SECRET: '你的值',
  ALIYUN_SMS_SIGN_NAME: '你的签名',
  ALIYUN_SMS_TEMPLATE_CODE: '你的模板Code',
  REDIS_URL: 'redis://127.0.0.1:6379',
  // ...其他已有变量
}
```
重启：`pm2 restart miaoji-server`

### 方式 B：~/.bashrc（当前用户）
```bash
echo 'export ALIYUN_ACCESS_KEY_ID="你的值"' >> ~/.bashrc
echo 'export ALIYUN_ACCESS_KEY_SECRET="你的值"' >> ~/.bashrc
echo 'export ALIYUN_SMS_SIGN_NAME="你的签名"' >> ~/.bashrc
echo 'export ALIYUN_SMS_TEMPLATE_CODE="你的模板Code"' >> ~/.bashrc
echo 'export REDIS_URL="redis://127.0.0.1:6379"' >> ~/.bashrc
source ~/.bashrc
```

### 方式 C：项目 .env 文件（不提交到 git）
在项目根目录创建/编辑 `.env`：
```
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
ALIYUN_SMS_SIGN_NAME=xxx
ALIYUN_SMS_TEMPLATE_CODE=xxx
REDIS_URL=redis://127.0.0.1:6379
```
并确保 `.env` 在 `.gitignore` 中。

**验证（仅输出变量名，不输出 secret 值）：**
```bash
echo "ALIYUN_ACCESS_KEY_ID is set: $(test -n "$ALIYUN_ACCESS_KEY_ID" && echo yes || echo no)"
echo "ALIYUN_SMS_SIGN_NAME is set: $(test -n "$ALIYUN_SMS_SIGN_NAME" && echo yes || echo no)"
echo "REDIS_URL: $REDIS_URL"
```

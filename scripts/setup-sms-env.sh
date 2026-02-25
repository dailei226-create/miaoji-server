#!/bin/bash
# 妙集 miaoji-server 短信环境配置 + PM2 重启 + curl 自测
# 用法：在服务器上 bash scripts/setup-sms-env.sh（需交互输入密钥/手机号，不回显敏感信息）
set -euo pipefail

echo "==[A] 安全检查（不碰你朋友的小程序）=="
echo "当前用户: $(whoami)"
if [ ! -d /www/miaoji/server ]; then
  echo "❌ 未找到 /www/miaoji/server（后端目录）"
  echo "请在服务器确认后端真实路径，再把结果发我。"
  exit 1
fi
echo "✅ 发现后端目录: /www/miaoji/server"

echo
echo "==[B] 检查 Redis（本机 127.0.0.1）=="
if command -v redis-cli >/dev/null 2>&1; then
  redis-cli ping | grep -q PONG && echo "✅ Redis PONG" || echo "⚠️ Redis 未返回 PONG（但继续）"
else
  echo "⚠️ 未找到 redis-cli（但你之前已装 Redis；如果需要我再补）。"
fi

echo
echo "==[C] 进入后端目录 & 准备 .env（不打印敏感信息）=="
cd /www/miaoji/server

ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  echo "✅ 已存在 $ENV_FILE（将备份一份，不展示内容）"
  cp -a "$ENV_FILE" ".env.bak.$(date +%Y%m%d%H%M%S)"
else
  echo "✅ 不存在 $ENV_FILE，将新建"
  : > "$ENV_FILE"
fi

echo
echo "接下来需要你输入阿里云短信配置（输入时不会显示字符，这是正常的）。"
read -p "Aliyun AccessKeyId: " AKID
read -s -p "Aliyun AccessKeySecret（不回显）: " AKS
echo
read -p "短信签名 SignName（如：妙集）: " SIGN
read -p "短信模板 TemplateCode（如：SMS_123456789）: " TPL

# 只写入，不回显
cat > "$ENV_FILE" <<EOF
# ===== 妙集 miaoji-server 生产环境变量（短信 + Redis）=====
# Redis（本机）
REDIS_URL=redis://127.0.0.1:6379

# 阿里云短信
ALIYUN_ACCESS_KEY_ID=${AKID}
ALIYUN_ACCESS_KEY_SECRET=${AKS}
ALIYUN_SMS_SIGN_NAME=${SIGN}
ALIYUN_SMS_TEMPLATE_CODE=${TPL}

# 你现有的其他变量如果需要保留，请稍后我带你追加（不会影响支付/订单）。
EOF

chmod 600 "$ENV_FILE" || true
echo "✅ 已写入 $ENV_FILE（已 chmod 600，未打印敏感值）"

echo
echo "==[D] 只重启你自己的后端进程（不碰其他 PM2 进程）=="
if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ 服务器上没有 pm2 命令（或当前用户无权限）。"
  echo "请把 pm2 list 的截图发我，我给你最短处理。"
  exit 1
fi

# 用 pm2 jlist 精准定位：cwd=/www/miaoji/server 或 name 含 miaoji-server
PM2_ID="$(pm2 jlist 2>/dev/null | node -e "
const fs=require('fs');
let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{
  try{
    const arr=JSON.parse(s);
    const hit=arr.find(p=>{
      const env=p.pm2_env||{};
      return env.pm_cwd==='/www/miaoji/server' || (p.name||'').includes('miaoji-server');
    });
    if(!hit){ process.exit(2); }
    process.stdout.write(String(hit.pm_id));
  }catch(e){ process.exit(3); }
});
")" || true

if [ -z "${PM2_ID:-}" ]; then
  echo "❌ 没有自动定位到 /www/miaoji/server 对应的 PM2 进程。"
  echo "请在服务器执行：pm2 list（把截图发我），我告诉你该重启哪一个 ID。"
  exit 1
fi

echo "✅ 命中 PM2 进程 ID: $PM2_ID（只重启这个）"
pm2 restart "$PM2_ID" --update-env
pm2 save >/dev/null 2>&1 || true
echo "✅ 已重启并 update-env"

echo
echo "==[E] 本机 curl 测试短信接口（不走域名，避免外部干扰）=="
read -p "请输入测试手机号（只用于测试，不会保存/不回显到日志）： " PHONE
echo "请求 /sms/send ..."
curl -sS -X POST "http://127.0.0.1:3100/sms/send" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${PHONE}\",\"scene\":\"bank_bind\"}" | head -c 800
echo
echo "（如需 verify，收到验证码后继续）"
read -p "如果你已收到验证码，输入验证码（没收到就直接回车跳过）： " CODE
if [ -n "${CODE:-}" ]; then
  echo "请求 /sms/verify ..."
  curl -sS -X POST "http://127.0.0.1:3100/sms/verify" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"${PHONE}\",\"scene\":\"bank_bind\",\"code\":\"${CODE}\"}" | head -c 800
  echo
else
  echo "已跳过 verify。"
fi

echo
echo "==[F] 输出后端最近日志（不含敏感 env）=="
pm2 logs "$PM2_ID" --lines 80 --nostream || true

echo
echo "✅ 脚本结束：如果 /sms/send 或 /sms/verify 返回异常，把上面输出整段复制给我（敏感信息已避免打印）。"

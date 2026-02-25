#!/usr/bin/env bash
set -euo pipefail

cd /www/miaoji/server

ENV_FILE=".env"
touch "$ENV_FILE"
cp -a "$ENV_FILE" ".env.bak.$(date +%Y%m%d%H%M%S)"

echo "== 输入阿里云短信配置（输入不回显是正常的）=="
read -r -p "Aliyun AccessKeyId: " AKID
read -r -s -p "Aliyun AccessKeySecret（不回显）: " AKS
echo
read -r -p "短信签名 SignName: " SIGN
read -r -p "短信模板 TemplateCode: " TPL
read -r -p "测试手机号: " PHONE

# 幂等写入/更新：存在则替换，不存在则追加
upsert() {
  local key="$1"
  local val="$2"
  local file="$3"
  if grep -qE "^${key}=" "$file"; then
    # 用 | 做分隔，避免 val 里有 /
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >> "$file"
  fi
}

# Redis（本机）
upsert "REDIS_URL" "redis://127.0.0.1:6379" "$ENV_FILE"

# 阿里云短信
upsert "ALIYUN_ACCESS_KEY_ID" "${AKID}" "$ENV_FILE"
upsert "ALIYUN_ACCESS_KEY_SECRET" "${AKS}" "$ENV_FILE"
upsert "ALIYUN_SMS_SIGN_NAME" "${SIGN}" "$ENV_FILE"
upsert "ALIYUN_SMS_TEMPLATE_CODE" "${TPL}" "$ENV_FILE"

chmod 600 "$ENV_FILE" || true

echo "== 定位并重启 miaoji-server（只重启 cwd=/www/miaoji/server 的进程）=="
if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ pm2 不存在或当前用户无权限"
  exit 1
fi

PM2_ID="$(pm2 jlist 2>/dev/null | node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const arr=JSON.parse(s||'[]');
  const hit=arr.find(p=>{
    const env=p.pm2_env||{};
    return env.pm_cwd==='/www/miaoji/server' || (p.name||'').includes('miaoji-server');
  });
  if(!hit){process.exit(2)}
  process.stdout.write(String(hit.pm_id));
});
")" || true

if [ -z "${PM2_ID:-}" ]; then
  echo "❌ 未找到 miaoji-server 对应的 PM2 进程（不会重启任何东西）"
  echo "请执行 pm2 list 并把截图发我"
  exit 1
fi

echo "✅ 命中 PM2 进程 ID: $PM2_ID"
pm2 restart "$PM2_ID" --update-env
pm2 save >/dev/null 2>&1 || true

echo "== 本机 curl 测试 /sms/send（含 scene=bank_bind）=="
curl -sS -X POST "http://127.0.0.1:3100/sms/send" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${PHONE}\",\"scene\":\"bank_bind\"}" | head -c 800
echo

echo "== 如果收到验证码，继续 /sms/verify（可回车跳过）=="
read -r -p "验证码 code（回车跳过）: " CODE
if [ -n "${CODE:-}" ]; then
  curl -sS -X POST "http://127.0.0.1:3100/sms/verify" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"${PHONE}\",\"scene\":\"bank_bind\",\"code\":\"${CODE}\"}" | head -c 800
  echo
else
  echo "已跳过 verify"
fi

echo "== 最近 80 行日志（不含敏感 env）=="
pm2 logs "$PM2_ID" --lines 80 --nostream || true

echo "✅ 完成。已备份 .env 为 .env.bak.*，且仅更新短信/Redis相关键。"

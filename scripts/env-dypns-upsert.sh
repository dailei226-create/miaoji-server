#!/usr/bin/env bash
# Step D: 仅 upsert 追加 DYPNS 相关变量到 .env，不覆盖已有项
# 用法：在服务器 /www/miaoji/server 执行 bash scripts/env-dypns-upsert.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=".env"
touch "$ENV_FILE"

upsert() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

upsert "DYPNS_SIGN_NAME" "速通互联验证码"
upsert "DYPNS_TEMPLATE_CODE" "100001"
upsert "DYPNS_VALID_TIME" "300"
upsert "DYPNS_INTERVAL" "60"
upsert "DYPNS_CODE_LENGTH" "4"
upsert "DYPNS_CODE_TYPE" "1"

echo "✅ 已 upsert DYPNS_* 变量到 $ENV_FILE"

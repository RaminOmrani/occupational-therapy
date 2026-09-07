#!/usr/bin/env bash
# به‌روزرسانی به آخرین نسخه کد و ری‌استارت سرویس‌ها
set -euo pipefail
cd /opt/clinic
export NODE_OPTIONS="--max-old-space-size=1536"
# پورت داخلی API (در زمان build داخل وب ثبت می‌شود)
export API_URL="http://127.0.0.1:4310"
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:push
pnpm build
pm2 delete clinic-api clinic-web >/dev/null 2>&1 || true
pm2 start deploy/ecosystem.config.cjs && pm2 save
echo "✔ به‌روزرسانی انجام شد"

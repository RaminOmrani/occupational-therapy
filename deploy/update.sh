#!/usr/bin/env bash
# به‌روزرسانی به آخرین نسخه کد و ری‌استارت سرویس‌ها
set -euo pipefail
cd /opt/clinic
export NODE_OPTIONS="--max-old-space-size=1536"
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:push
pnpm build
pm2 restart clinic-api clinic-web
echo "✔ به‌روزرسانی انجام شد"

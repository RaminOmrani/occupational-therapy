#!/usr/bin/env bash
# به‌روزرسانی به آخرین نسخه کد و ری‌استارت سرویس‌ها
set -euo pipefail
cd /opt/clinic
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:push
pnpm build
pm2 restart clinic-api clinic-web
echo "✔ به‌روزرسانی انجام شد"

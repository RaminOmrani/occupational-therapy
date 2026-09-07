#!/usr/bin/env bash
# نصب کامل روی Ubuntu 20.04/22.04/24.04 — اجرا با root:
#   bash install.sh                      → سرویس روی http://IP
#   bash install.sh clinic.example.ir    → با دامنه + https خودکار
set -euo pipefail
DOMAIN="${1:-}"
# اگر مخزن خصوصی است: GITHUB_TOKEN=xxxx bash install.sh
REPO="https://${GITHUB_TOKEN:+${GITHUB_TOKEN}@}github.com/RaminOmrani/occupational-therapy.git"
BRANCH="claude/occupational-clinic-software-t2stj6"
DIR="/opt/clinic"

log() { echo -e "\n\033[1;32m▶ $*\033[0m"; }

log "پیش‌نیازها"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx ufw ca-certificates sqlite3

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  log "نصب Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
command -v pnpm >/dev/null 2>&1 || npm install -g pnpm
command -v pm2 >/dev/null 2>&1 || npm install -g pm2

if [ -d "$DIR/.git" ]; then
  log "به‌روزرسانی کد"
  git -C "$DIR" remote set-url origin "$REPO"
  git -C "$DIR" fetch origin "$BRANCH" && git -C "$DIR" checkout "$BRANCH" && git -C "$DIR" pull --ff-only origin "$BRANCH"
else
  log "دریافت کد"
  git clone -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

# سرورهای کم‌حافظه: فضای swap برای ساخت Next.js
if [ "$(free -m | awk '/Swap:/{print $2}')" -lt 1024 ] && [ ! -f /swapfile ]; then
  log "ایجاد ۲ گیگابایت swap"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi
export NODE_OPTIONS="--max-old-space-size=1536"

log "نصب وابستگی‌ها و ساخت"
pnpm install --frozen-lockfile
pnpm db:push
if [ ! -s apps/api/data/clinic.db ] || [ "$(sqlite3 apps/api/data/clinic.db 'select count(*) from User' 2>/dev/null || echo 0)" = "0" ]; then
  pnpm db:seed || true
fi
pnpm build

PUBLIC_URL="http://$(curl -s4 ifconfig.me || hostname -I | awk '{print $1}')"
[ -n "$DOMAIN" ] && PUBLIC_URL="https://$DOMAIN"
pnpm --filter @toranj/api set-setting site.baseUrl "$PUBLIC_URL" || true

log "راه‌اندازی سرویس‌ها با pm2"
pm2 delete clinic-api clinic-web >/dev/null 2>&1 || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

log "تنظیم nginx"
sed "s/__SERVER_NAME__/${DOMAIN:-_}/" deploy/nginx.conf.template > /etc/nginx/sites-available/clinic
ln -sf /etc/nginx/sites-available/clinic /etc/nginx/sites-enabled/clinic
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

log "فایروال"
ufw allow OpenSSH >/dev/null; ufw allow 80 >/dev/null; ufw allow 443 >/dev/null; ufw --force enable >/dev/null

if [ -n "$DOMAIN" ]; then
  log "گواهی https برای $DOMAIN"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo "⚠ certbot ناموفق بود؛ مطمئن شوید DNS دامنه به این سرور اشاره می‌کند و دوباره اجرا کنید: certbot --nginx -d $DOMAIN"
fi

log "تمام شد"
echo "آدرس: $PUBLIC_URL"
echo "ورود مدیر: 09120000001 / admin1234   (حتماً رمز را عوض کنید)"
echo "وضعیت سرویس‌ها: pm2 status   |   لاگ: pm2 logs"

#!/usr/bin/env bash
# عیب‌یابی سریع: خروجی این دستور را برای پشتیبانی بفرستید
cd /opt/clinic 2>/dev/null || { echo "پوشه /opt/clinic وجود ندارد"; exit 1; }
echo "=== git"; git log --oneline -1; git status --short | head -5
echo "=== node/pnpm"; node -v; pnpm -v; free -m | head -2
echo "=== pm2"; pm2 status 2>/dev/null | grep -E "clinic|name"
echo "=== ports"; ss -ltnp 2>/dev/null | grep -E ":3000|:4310|:80 " || echo "no listeners"
echo "=== api health (direct)"; curl -s -m 5 http://127.0.0.1:4310/api/health || echo "API پاسخ نمی‌دهد"; echo
echo "=== api via web proxy"; curl -s -m 8 http://127.0.0.1:3000/api/health || echo "پراکسی وب پاسخ نمی‌دهد"; echo
echo "=== login test"; curl -s -m 8 -o /dev/null -w "HTTP %{http_code}\n" -X POST http://127.0.0.1:3000/api/auth/login -H 'content-type: application/json' -d '{"phone":"09120000001","password":"admin1234"}'
echo "=== nginx"; nginx -t 2>&1 | tail -1; curl -s -m 5 -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1/
echo "=== api log (last 30)"; tail -n 30 /root/.pm2/logs/clinic-api-error.log 2>/dev/null; tail -n 15 /root/.pm2/logs/clinic-api-out.log 2>/dev/null
echo "=== web log (last 30)"; tail -n 30 /root/.pm2/logs/clinic-web-error.log 2>/dev/null; tail -n 10 /root/.pm2/logs/clinic-web-out.log 2>/dev/null

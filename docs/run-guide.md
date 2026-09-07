# راهنمای اجرا (قدم‌به‌قدم، بدون پیش‌زمینه فنی)

## ۱) روی کامپیوتر خودتان (برای دیدن و تست)

1. **Node.js** را نصب کنید: به https://nodejs.org بروید و نسخه **LTS** را دانلود و نصب کنید (Next, Next, Finish).
2. کد را دانلود کنید: در گیت‌هاب روی دکمه سبز **Code → Download ZIP** بزنید (برنچ `claude/occupational-clinic-software-t2stj6`) و فایل را از حالت فشرده خارج کنید. یا اگر Git دارید:
   `git clone -b claude/occupational-clinic-software-t2stj6 https://github.com/RaminOmrani/occupational-therapy.git`
3. **ترمینال را داخل پوشه پروژه باز کنید**:
   - ویندوز: وارد پوشه شوید، در نوار آدرس بالای پنجره بنویسید `cmd` و Enter بزنید.
   - مک: پوشه را روی آیکون Terminal بکشید، یا در Terminal بنویسید `cd ` و پوشه را داخل پنجره رها کنید.
4. این سه دستور را یکی‌یکی بنویسید و Enter بزنید:
   ```
   npm install -g pnpm
   pnpm first-run
   pnpm dev
   ```
   دستور دوم چند دقیقه طول می‌کشد (دانلود وابستگی‌ها + ساخت دیتابیس + داده نمونه).
5. وقتی نوشت `API ready` و `Ready`، در مرورگر بروید به **http://localhost:3000**
6. ورود: مدیر `09120000001` رمز `admin1234`. (منشی `09120000002`، درمانگر `09120000003` و `09120000004` با همان رمز؛ بیمار نمونه `09120000010` رمز `OT-00001`.)

برای بستن، در ترمینال `Ctrl+C` بزنید. دفعات بعد فقط `pnpm dev` کافی است.

## ۲) روی سرور (برای استفاده واقعی کلینیک از هر جا)

به یک **سرور مجازی (VPS) ایران** با اوبونتو (مثلاً از ابرآروان، لیارا، پارس‌پک، ایران‌سرور) و یک **دامنه** (مثل zehnesabz.ir) نیاز دارید. سپس:

```bash
# روی سرور
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs git
npm install -g pnpm pm2
git clone -b claude/occupational-clinic-software-t2stj6 https://github.com/RaminOmrani/occupational-therapy.git && cd occupational-therapy
pnpm install && pnpm db:push && pnpm db:seed
pnpm build
pm2 start "pnpm --filter @toranj/api start" --name clinic-api
pm2 start "pnpm --filter @toranj/web start" --name clinic-web
pm2 save && pm2 startup
```
سپس Nginx را طوری تنظیم کنید که دامنه به پورت 3000 وصل شود و با `certbot` گواهی https بگیرید. در پنل مدیریت ← تنظیمات ← سایت عمومی، «آدرس سایت» را روی `https://دامنه‌شما` بگذارید (برای لینک پیامک‌ها و بازگشت از درگاه).

اگر مشخصات سرور را بدهید، این مرحله را هم می‌توانم برایتان انجام دهم.

## ۳) بعد از اولین ورود

1. تنظیمات ← اطلاعات کلینیک را بررسی کنید (نام، آدرس، تلفن، شماره نظام از قبل وارد شده).
2. کاربران و درمانگران ← رمز مدیر را عوض کنید و درمانگران واقعی را اضافه/ویرایش کنید.
3. تنظیمات ← پیامک ← مشخصات ملی‌پیامک را وارد و «پیامک آزمایشی» بزنید.
4. تنظیمات ← درگاه پرداخت ← مرچنت زرین‌پال (اختیاری).
5. داده‌های نمونه را می‌توانید نگه دارید یا بیماران نمونه را بایگانی کنید.

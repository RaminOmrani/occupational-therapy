# پیامک و ملی‌پیامک

## تنظیم اتصال (پنل مدیریت ← تنظیمات ← پیامک)

| کلید | توضیح |
|---|---|
| `sms.provider` | `mock` (بدون ارسال واقعی) / `melipayamak-rest` / `melipayamak-console` |
| `sms.username` , `sms.password` | برای حالت REST (وب‌سرویس `rest.payamak-panel.com`) |
| `sms.apiKey` | برای حالت کنسول (`console.melipayamak.com/api`) |
| `sms.from` | شماره فرستنده (خط اختصاصی) |
| `sms.usePatterns` | اگر فعال باشد، الگوهایی که «کد الگو» دارند با سرویس الگو (خدماتی) ارسال می‌شوند |
| `sms.signature` | امضای انتهای پیام‌ها |
| `sms.autoOnFix` / `sms.autoReminder` / `sms.autoWelcome` | روشن/خاموش‌کردن ارسال‌های خودکار |

پس از ذخیره، با دکمه «ارسال پیامک آزمایشی» صحت تنظیمات را بررسی کنید. وضعیت هر ارسال (موفق/ناموفق + متن خطای فارسی‌شده) در «پیامک ← گزارش ارسال» ثبت می‌شود.

## الگوهای سیستمی

الگوها در «پیامک ← الگوها» قابل ویرایش‌اند. متغیرها با `{{name}}` نوشته می‌شوند و امضای کلینیک با `{{clinic}}` در دسترس است.

| کلید | رویداد | متغیرها |
|---|---|---|
| `otp` | ورود با کد یکبارمصرف | clinic, code, minutes |
| `welcome` | ساخت پرونده بیمار | name, clinic, fileNumber |
| `appointment_fixed` | قطعی‌شدن نوبت توسط منشی (به بیمار) | name, therapist, date, time, clinic |
| `appointment_fixed_therapist` | خلاصه برنامه روز (به درمانگر) | name, date, count, time, clinic |
| `appointment_reminder` | N ساعت قبل از جلسه (پیش‌فرض ۲) | name, therapist, time, clinic |
| `appointment_cancelled` | لغو نوبت | name, date, time, clinic |
| `payment_received` | ثبت پرداخت (اختیاری) | name, amount, currency, balance, clinic |
| `debt_reminder` | دکمه یادآوری بدهی در پروفایل مالی | name, balance, currency, clinic |
| `birthday` | روز تولد (در صورت فعال‌بودن `crm.birthdaySmsEnabled`) | name, clinic |
| `lead_followup` | پیگیری لید | name, clinic, phone |
| `general` | هر پیام دلخواه تکی/گروهی | message, clinic |

برای ارسال خدماتی، در ملی‌پیامک همان متن را با متغیرها به ترتیب جدول بالا ثبت کنید و **کد الگو (bodyId)** را در همان الگو وارد کنید. ترتیب متغیرها همان ترتیب فیلد `variables` الگو است.

## ارسال گروهی (CRM)

«پیامک ← ارسال گروهی»: گیرندگان را با فیلترهایی مثل وضعیت پرونده، درمانگر، جنسیت، بدهکار/تسویه‌شده، تولد در N روز آینده، بازه سنی، آخرین مراجعه، برچسب، یا وضعیت/منبع لید مشخص کنید، تعداد و فهرست را ببینید و کمپین را ارسال کنید. `{{name}}` با نام هر گیرنده جایگزین می‌شود. پیشرفت ارسال در تب «کمپین‌ها» زنده به‌روز می‌شود.

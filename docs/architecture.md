# معماری و مدل داده

## نقش‌ها و دسترسی

| نقش | دسترسی |
|---|---|
| `ADMIN` | همه‌چیز + تنظیمات، کاربران، حذف/ابطال، گزارش فعالیت |
| `SECRETARY` | برنامه‌ریزی و قطعی‌کردن روز، بیماران، لیدها، مالی (صورت‌حساب/پرداخت/کیف پول/تخفیف)، پیامک، بازخوردها، مقالات؛ فرم‌های بالینی فقط خواندنی |
| `THERAPIST` | برنامه و بیماران خود، ثبت/ویرایش فرم‌های بالینی خود، اهداف و تمرین خانگی، مقالات |
| `PATIENT` | فقط داده‌های خودش: جلسات، فرم‌های علامت‌خورده «قابل نمایش»، مالی، تمرین خانگی، بازخورد |

احراز هویت با JWT در کوکی HttpOnly (`ot_token`) و کوکی نقش (`ot_role`) برای هدایت مسیرها؛ اعتبارسنجی نهایی همیشه در API انجام می‌شود.

## مدل داده (Prisma)

- **User** ← Therapist / Patient (اختیاری). بیمار می‌تواند بدون حساب کاربری هم باشد.
- **Patient**: `fileNumber` یکتا، اطلاعات فردی، درمانگر اصلی، برچسب‌ها، ارتباط با Lead.
- **Lead** + **LeadActivity**: قیف فروش `NEW → CONTACTED → INTERESTED → CONVERTED/LOST`.
- **Appointment**: بازه زمانی، وضعیت (`SCHEDULED → CONFIRMED → DONE/CANCELLED/NO_SHOW`)، زمان قطعی‌شدن و زمان ارسال پیامک‌ها، اتصال به صورت‌حساب.
- فرم‌های بالینی: **IntakeForm**، **Assessment** (نوع + آیتم‌های JSON + امتیاز)، **ProgressNote** (SOAP)، **DailyPerformance**، **TreatmentGoal**، **HomeProgram**، **Document**.
- مالی: **Invoice** (اقلام JSON، تخفیف، پرداختی، وضعیت)، **Payment** (روش، مرجع)، **WalletTransaction** (+/−)، **Discount**.
  - مانده حساب = جمع صورت‌حساب‌های صادرشده − جمع پرداخت‌ها. مثبت = بدهکار، منفی = بستانکار.
  - پرداخت با روش `WALLET` موجودی کیف پول را کم می‌کند.
- **Feedback** (بیمار یا مهمان سایت)، **Article**، **SmsTemplate / SmsLog / SmsCampaign**، **Setting**، **Counter** (شماره‌گذاری)، **Notification**، **AuditLog**، **OtpCode**.

همه‌ی enumها به‌صورت رشته ذخیره می‌شوند تا SQLite و PostgreSQL هر دو پشتیبانی شوند؛ مقادیر مجاز در `packages/shared/src/constants.ts` هستند.

## مسیرهای API (خلاصه)

```
POST /api/auth/login | otp/request | otp/verify | logout      GET /api/auth/me
GET/POST /api/patients   GET /api/patients/lookup | birthdays   GET/PATCH /api/patients/:id   GET /api/patients/:id/timeline
GET/POST /api/leads   POST /api/leads/quick   GET/PATCH/DELETE /api/leads/:id   POST /api/leads/:id/activities | sms
GET/POST /api/appointments   GET /api/appointments/mine | stats   PATCH/DELETE /api/appointments/:id
POST /api/appointments/fix-day   POST /api/appointments/copy-day
/api/forms/intake | assessments | progress | daily | goals | home-programs  (CRUD)   GET /api/forms/assessments/trend/:patientId
GET /api/finance/patients/:id | statement   /api/finance/invoices | payments | wallet | discounts   GET /api/finance/report
/api/feedback   /api/articles (+ /public)   /api/sms/templates | send | recipients | campaigns | logs | status
GET /api/settings/public   GET/PUT /api/settings   POST /api/settings/sms-test
/api/users   GET /api/users/therapists   GET /api/dashboard   /api/notifications   /api/uploads   /api/public/clinic | contact | feedback
```

فیلترهای فهرست‌ها با query string: `q`, `status`, `therapistId`, `patientId`, `from`, `to`, `type`, `gender`, `debt`, `birthdayWithin`, `page`, `pageSize`.

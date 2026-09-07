export const APPOINTMENT_STATUSES = ["SCHEDULED", "CONFIRMED", "DONE", "CANCELLED", "NO_SHOW"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "برنامه‌ریزی‌شده",
  CONFIRMED: "قطعی‌شده",
  DONE: "انجام‌شده",
  CANCELLED: "لغو‌شده",
  NO_SHOW: "غیبت",
};

export const LEAD_STATUSES = ["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "جدید",
  CONTACTED: "تماس گرفته‌شده",
  INTERESTED: "علاقه‌مند",
  CONVERTED: "تبدیل به بیمار",
  LOST: "از دست رفته",
};

export const LEAD_SOURCES = ["PHONE", "WEBSITE", "INSTAGRAM", "REFERRAL", "WALK_IN", "OTHER"] as const;
export const LEAD_SOURCE_LABELS: Record<(typeof LEAD_SOURCES)[number], string> = {
  PHONE: "تماس تلفنی",
  WEBSITE: "وب‌سایت",
  INSTAGRAM: "اینستاگرام",
  REFERRAL: "معرفی",
  WALK_IN: "مراجعه حضوری",
  OTHER: "سایر",
};

export const PATIENT_STATUSES = ["ACTIVE", "DISCHARGED", "ARCHIVED"] as const;
export type PatientStatus = (typeof PATIENT_STATUSES)[number];
export const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
  ACTIVE: "در حال درمان",
  DISCHARGED: "ترخیص‌شده",
  ARCHIVED: "بایگانی",
};

export const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "WALLET", "ONLINE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "نقدی",
  CARD: "کارتخوان",
  TRANSFER: "کارت به کارت / حواله",
  WALLET: "کیف پول",
  ONLINE: "درگاه آنلاین",
};

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PARTIAL", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "پیش‌نویس",
  ISSUED: "صادر‌شده",
  PARTIAL: "پرداخت جزئی",
  PAID: "تسویه‌شده",
  CANCELLED: "باطل‌شده",
};

export const WALLET_TX_TYPES = ["DEPOSIT", "WITHDRAW", "CHARGE", "REFUND", "GIFT", "ADJUST"] as const;
export type WalletTxType = (typeof WALLET_TX_TYPES)[number];
export const WALLET_TX_LABELS: Record<WalletTxType, string> = {
  DEPOSIT: "شارژ کیف پول",
  WITHDRAW: "برداشت",
  CHARGE: "پرداخت از کیف پول",
  REFUND: "بازگشت وجه",
  GIFT: "هدیه / اعتبار",
  ADJUST: "اصلاح حساب",
};

export const FEEDBACK_TYPES = ["COMPLAINT", "SUGGESTION", "PRAISE"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  COMPLAINT: "انتقاد",
  SUGGESTION: "پیشنهاد",
  PRAISE: "تشکر",
};
export const FEEDBACK_STATUSES = ["OPEN", "REVIEWED", "RESOLVED"] as const;
export const FEEDBACK_STATUS_LABELS: Record<(typeof FEEDBACK_STATUSES)[number], string> = {
  OPEN: "جدید",
  REVIEWED: "بررسی‌شده",
  RESOLVED: "پاسخ داده‌شده",
};

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  MALE: "مرد",
  FEMALE: "زن",
  OTHER: "سایر",
};

export const GOAL_STATUSES = ["ACTIVE", "ACHIEVED", "PAUSED", "DROPPED"] as const;
export const GOAL_STATUS_LABELS: Record<(typeof GOAL_STATUSES)[number], string> = {
  ACTIVE: "در حال پیگیری",
  ACHIEVED: "محقق‌شده",
  PAUSED: "متوقف",
  DROPPED: "منتفی",
};

/** پیش‌فرض‌های تنظیمات؛ همه از پنل مدیریت قابل تغییرند و در دیتابیس ذخیره می‌شوند */
export const DEFAULT_SETTINGS: Record<string, { value: string; group: string; label: string; description?: string; type: "text" | "number" | "boolean" | "json" | "password" | "textarea" | "select"; options?: string[]; secret?: boolean }> = {
  "clinic.name": { value: "کلینیک کاردرمانی ذهن سبز", group: "clinic", label: "نام کلینیک", type: "text" },
  "clinic.licenseNo": { value: "ک.د ۲۴۳۰", group: "clinic", label: "شماره نظام پزشکی / مجوز", type: "text" },
  "clinic.tagline": { value: "همراه شما در مسیر استقلال و توانمندی", group: "clinic", label: "شعار کلینیک", type: "text" },
  "clinic.phone": { value: "05138667661", group: "clinic", label: "تلفن کلینیک", type: "text" },
  "clinic.mobile": { value: "", group: "clinic", label: "موبایل / واتساپ", type: "text" },
  "clinic.address": { value: "مشهد - حاشیه خیابان معلم، نرسیده به معلم ۶۳، پلاک ۱۵۳۳، طبقه اول، واحد ۲", group: "clinic", label: "آدرس", type: "textarea" },
  "clinic.email": { value: "", group: "clinic", label: "ایمیل", type: "text" },
  "clinic.instagram": { value: "", group: "clinic", label: "اینستاگرام", type: "text" },
  "clinic.workingHours": { value: "شنبه تا پنجشنبه، ۸ صبح تا ۸ شب", group: "clinic", label: "ساعات کاری (متن)", type: "text" },
  "clinic.about": { value: "کلینیک کاردرمانی ذهن سبز در مشهد با تیمی از درمانگران مجرب، خدمات کاردرمانی جسمی، ذهنی و شناختی را برای کودکان و بزرگسالان ارائه می‌دهد.", group: "clinic", label: "درباره ما", type: "textarea" },
  "clinic.mapUrl": { value: "", group: "clinic", label: "لینک نقشه", type: "text" },
  "clinic.services": {
    value: JSON.stringify([
      { title: "کاردرمانی جسمی", description: "بهبود دامنه حرکتی، قدرت عضلانی و مهارت‌های حرکتی ظریف و درشت", icon: "activity" },
      { title: "کاردرمانی ذهنی و شناختی", description: "تقویت توجه، حافظه، حل مسئله و کارکردهای اجرایی", icon: "brain" },
      { title: "یکپارچگی حسی", description: "تنظیم پردازش حسی برای کودکان با اختلالات حسی", icon: "sparkles" },
      { title: "توانبخشی سکته و آسیب مغزی", description: "بازگشت به فعالیت‌های روزمره پس از آسیب‌های عصبی", icon: "heart-pulse" },
      { title: "مهارت‌های زندگی روزمره", description: "آموزش استقلال در فعالیت‌های روزمره زندگی (ADL)", icon: "home" },
      { title: "ارزیابی تخصصی", description: "ارزیابی جامع جسمی، ادراکی-حرکتی و شناختی", icon: "clipboard-check" },
    ]),
    group: "clinic",
    label: "خدمات (JSON)",
    type: "json",
  },
  "schedule.defaultDuration": { value: "45", group: "schedule", label: "مدت پیش‌فرض هر جلسه (دقیقه)", type: "number" },
  "schedule.startHour": { value: "8", group: "schedule", label: "ساعت شروع کار", type: "number" },
  "schedule.endHour": { value: "20", group: "schedule", label: "ساعت پایان کار", type: "number" },
  "schedule.slotMinutes": { value: "15", group: "schedule", label: "دقت زمان‌بندی (دقیقه)", type: "number" },
  "schedule.reminderHoursBefore": { value: "2", group: "schedule", label: "یادآوری پیامکی چند ساعت قبل از جلسه", type: "number" },
  "schedule.defaultSessionPrice": { value: "500000", group: "finance", label: "قیمت پیش‌فرض هر جلسه (تومان)", type: "number" },
  "finance.currency": { value: "تومان", group: "finance", label: "واحد پول", type: "text" },
  "finance.dueDays": { value: "7", group: "finance", label: "مهلت پرداخت صورت‌حساب (روز)", type: "number" },
  "finance.cardNumber": { value: "", group: "finance", label: "شماره کارت کلینیک (برای کارت‌به‌کارت)", type: "text", description: "به بیماران در بخش مالی نمایش داده می‌شود" },
  "finance.cardOwner": { value: "", group: "finance", label: "نام صاحب کارت", type: "text" },
  "finance.paymentNote": { value: "پس از واریز، از بخش «اعلام پرداخت» مبلغ و شماره پیگیری را ثبت کنید تا پس از تأیید پذیرش در حساب شما منظور شود.", group: "finance", label: "راهنمای پرداخت برای بیمار", type: "textarea" },
  "crm.birthdayDaysAhead": { value: "7", group: "crm", label: "نمایش تولدهای چند روز آینده", type: "number" },
  "crm.birthdaySmsEnabled": { value: "false", group: "crm", label: "ارسال خودکار پیامک تبریک تولد", type: "boolean" },
  "sms.provider": { value: "mock", group: "sms", label: "حالت ارسال پیامک", type: "select", options: ["mock", "melipayamak-rest", "melipayamak-console"], description: "mock: بدون ارسال واقعی (فقط ثبت در لاگ). melipayamak-rest: با نام کاربری و رمز. melipayamak-console: با کلید API کنسول." },
  "sms.username": { value: "", group: "sms", label: "نام کاربری ملی‌پیامک", type: "text" },
  "sms.password": { value: "", group: "sms", label: "رمز عبور ملی‌پیامک", type: "password", secret: true },
  "sms.apiKey": { value: "", group: "sms", label: "کلید API کنسول ملی‌پیامک", type: "password", secret: true },
  "sms.from": { value: "", group: "sms", label: "شماره فرستنده", type: "text" },
  "sms.usePatterns": { value: "false", group: "sms", label: "استفاده از الگوهای تأییدشده (خدماتی) برای الگوهای سیستمی", type: "boolean", description: "اگر فعال باشد، الگوهایی که کد الگو (bodyId) دارند از طریق سرویس الگو ارسال می‌شوند." },
  "sms.signature": { value: "کلینیک کاردرمانی ذهن سبز", group: "sms", label: "امضای انتهای پیامک‌ها", type: "text" },
  "sms.autoOnFix": { value: "true", group: "sms", label: "ارسال خودکار پیامک هنگام قطعی‌شدن برنامه", type: "boolean" },
  "sms.autoReminder": { value: "true", group: "sms", label: "ارسال خودکار یادآوری قبل از جلسه", type: "boolean" },
  "sms.autoWelcome": { value: "true", group: "sms", label: "ارسال پیامک خوش‌آمد به بیمار جدید", type: "boolean" },
  "security.otpTtlMinutes": { value: "5", group: "security", label: "اعتبار کد یکبارمصرف (دقیقه)", type: "number" },
  "security.sessionDays": { value: "14", group: "security", label: "مدت اعتبار ورود (روز)", type: "number" },
  "public.showTherapists": { value: "true", group: "public", label: "نمایش درمانگران در سایت", type: "boolean" },
  "public.heroTitle": { value: "ذهنی سبز، زندگی‌ای توانمند", group: "public", label: "عنوان اصلی صفحه نخست", type: "text" },
  "site.baseUrl": { value: "http://localhost:3000", group: "public", label: "آدرس سایت (برای لینک پیامک‌ها و بازگشت از درگاه)", type: "text", description: "مثال: https://zehnesabz.ir" },
  "booking.enabled": { value: "true", group: "booking", label: "نوبت‌دهی آنلاین از سایت", type: "boolean" },
  "booking.daysAhead": { value: "14", group: "booking", label: "تا چند روز آینده قابل رزرو باشد", type: "number" },
  "booking.autoSms": { value: "true", group: "booking", label: "پیامک به بیمار پس از تأیید درخواست", type: "boolean" },
  "payment.provider": { value: "off", group: "payment", label: "درگاه پرداخت آنلاین", type: "select", options: ["off", "zarinpal"], description: "برای فعال‌سازی، مرچنت زرین‌پال را وارد کنید." },
  "payment.merchantId": { value: "", group: "payment", label: "مرچنت آی‌دی زرین‌پال", type: "password", secret: true },
  "payment.sandbox": { value: "true", group: "payment", label: "حالت آزمایشی (sandbox) زرین‌پال", type: "boolean" },
  "payment.minAmount": { value: "10000", group: "payment", label: "حداقل مبلغ پرداخت آنلاین (تومان)", type: "number" },
  "survey.enabled": { value: "true", group: "crm", label: "رضایت‌سنجی خودکار پیامکی", type: "boolean" },
  "survey.everySessions": { value: "5", group: "crm", label: "هر چند جلسه یک‌بار رضایت‌سنجی ارسال شود", type: "number" },
  "consent.required": { value: "true", group: "consent", label: "دریافت رضایت‌نامه از بیماران جدید الزامی باشد", type: "boolean" },
  "consent.title": { value: "رضایت‌نامه آگاهانه درمان", group: "consent", label: "عنوان رضایت‌نامه", type: "text" },
  "consent.text": { value: "اینجانب با آگاهی کامل از روند درمان کاردرمانی، اهداف، مدت و هزینه‌های آن، رضایت خود را برای شروع و ادامه درمان در کلینیک اعلام می‌دارم.\nمتعهد می‌شوم در جلسات به‌موقع حاضر شوم و در صورت لغو، حداقل ۲۴ ساعت قبل اطلاع دهم.\nاطلاعات پرونده محرمانه است و فقط در اختیار تیم درمان قرار می‌گیرد.", group: "consent", label: "متن رضایت‌نامه", type: "textarea", description: "با تغییر متن، بیماران باید نسخه جدید را دوباره امضا کنند." },
  "backup.enabled": { value: "true", group: "security", label: "بکاپ خودکار روزانه دیتابیس (۳ بامداد)", type: "boolean" },
  "backup.keep": { value: "14", group: "security", label: "تعداد نسخه‌های بکاپ نگه‌داری‌شده", type: "number" },
  "public.heroSubtitle": { value: "کلینیک تخصصی کاردرمانی کودکان و بزرگسالان؛ ارزیابی دقیق، برنامه درمانی شخصی و پیگیری مستمر پیشرفت", group: "public", label: "زیرعنوان صفحه نخست", type: "textarea" },
};

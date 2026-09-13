/**
 * الگوهای پیامک سیستمی. متن هر الگو از پنل مدیریت قابل ویرایش است و
 * جای‌گذارها با {{name}} مشخص می‌شوند. برای ارسال با سرویس الگوی ملی‌پیامک،
 * کد الگو (bodyId) در پنل ثبت می‌شود و ترتیب متغیرها همان ترتیب فیلد variables است.
 */
export interface SmsTemplateDef {
  key: string;
  name: string;
  body: string;
  variables: string[];
  /** ترتیب متغیرهایی که در الگوی ملی‌پیامک به‌صورت {0},{1},... ثبت می‌شوند (نام کلینیک ثابت در متن است) */
  patternArgs: string[];
  description: string;
}

export const SMS_TEMPLATE_DEFAULTS: SmsTemplateDef[] = [
  {
    key: "otp",
    name: "کد ورود یکبارمصرف",
    body: "کد ورود شما به {{clinic}}: {{code}}\nاین کد تا {{minutes}} دقیقه معتبر است.",
    variables: ["clinic", "code", "minutes"],
    patternArgs: ["code", "minutes"],
    description: "هنگام ورود بیمار با شماره موبایل ارسال می‌شود.",
  },
  {
    key: "welcome",
    name: "خوش‌آمد به بیمار جدید",
    body: "{{name}} عزیز، به {{clinic}} خوش آمدید. شماره پرونده شما: {{fileNumber}}\nبرای مشاهده برنامه جلسات و پرونده خود با همین شماره وارد اپلیکیشن شوید.",
    variables: ["name", "clinic", "fileNumber"],
    patternArgs: ["name", "fileNumber"],
    description: "پس از ثبت پرونده بیمار ارسال می‌شود.",
  },
  {
    key: "appointment_fixed",
    name: "قطعی‌شدن نوبت",
    body: "{{name}} عزیز، نوبت شما با {{therapist}} در تاریخ {{date}} ساعت {{time}} قطعی شد.\n{{clinic}}",
    variables: ["name", "therapist", "date", "time", "clinic"],
    patternArgs: ["name", "therapist", "date", "time"],
    description: "به‌محض قطعی‌شدن برنامه توسط منشی به بیمار ارسال می‌شود.",
  },
  {
    key: "appointment_fixed_therapist",
    name: "برنامه روزانه درمانگر",
    body: "{{name}} عزیز، برنامه {{date}} شما قطعی شد: {{count}} جلسه، اولین جلسه ساعت {{time}}.\n{{clinic}}",
    variables: ["name", "date", "count", "time", "clinic"],
    patternArgs: ["name", "date", "count", "time"],
    description: "پس از قطعی‌شدن برنامه روز به درمانگر ارسال می‌شود.",
  },
  {
    key: "appointment_reminder",
    name: "یادآوری جلسه",
    body: "{{name}} عزیز، یادآوری: جلسه شما با {{therapist}} امروز ساعت {{time}} برگزار می‌شود. لطفاً ۱۰ دقیقه زودتر حضور داشته باشید.\n{{clinic}}",
    variables: ["name", "therapist", "time", "clinic"],
    patternArgs: ["name", "therapist", "time"],
    description: "دو ساعت (قابل تنظیم) قبل از شروع جلسه ارسال می‌شود.",
  },
  {
    key: "appointment_cancelled",
    name: "لغو نوبت",
    body: "{{name}} عزیز، نوبت شما در تاریخ {{date}} ساعت {{time}} لغو شد. برای تعیین نوبت جدید با ما تماس بگیرید.\n{{clinic}}",
    variables: ["name", "date", "time", "clinic"],
    patternArgs: ["name", "date", "time"],
    description: "هنگام لغو نوبت ارسال می‌شود.",
  },
  {
    key: "payment_received",
    name: "رسید پرداخت",
    body: "{{name}} عزیز، پرداخت شما به مبلغ {{amount}} {{currency}} ثبت شد. مانده حساب: {{balance}} {{currency}}\n{{clinic}}",
    variables: ["name", "amount", "currency", "balance", "clinic"],
    patternArgs: ["name", "amount", "balance"],
    description: "پس از ثبت پرداخت ارسال می‌شود.",
  },
  {
    key: "debt_reminder",
    name: "یادآوری بدهی",
    body: "{{name}} عزیز، مانده بدهی شما {{balance}} {{currency}} است. لطفاً نسبت به تسویه اقدام فرمایید.\n{{clinic}}",
    variables: ["name", "balance", "currency", "clinic"],
    patternArgs: ["name", "balance"],
    description: "به‌صورت دستی از پروفایل مالی بیمار ارسال می‌شود.",
  },
  {
    key: "birthday",
    name: "تبریک تولد",
    body: "{{name}} عزیز، تولدتان مبارک! آرزوی سلامتی و شادی برای شما داریم.\n{{clinic}}",
    variables: ["name", "clinic"],
    patternArgs: ["name"],
    description: "در روز تولد بیمار (در صورت فعال‌بودن) ارسال می‌شود.",
  },
  {
    key: "lead_followup",
    name: "پیگیری لید",
    body: "{{name}} عزیز، از تماس شما با {{clinic}} سپاسگزاریم. برای رزرو جلسه ارزیابی رایگان با شماره {{phone}} تماس بگیرید.",
    variables: ["name", "clinic", "phone"],
    patternArgs: ["name", "phone"],
    description: "برای پیگیری سرنخ‌های فروش استفاده می‌شود.",
  },
  {
    key: "survey",
    name: "رضایت‌سنجی",
    body: "{{name}} عزیز، نظر شما برای ما مهم است. لطفاً با لینک زیر رضایت خود از جلسات را ثبت کنید:\n{{siteHost}}/survey/{{token}}\n{{clinic}}",
    variables: ["name", "siteHost", "token", "clinic"],
    patternArgs: ["name", "token"],
    description: "پس از هر N جلسه انجام‌شده (قابل تنظیم) ارسال می‌شود.",
  },
  {
    key: "booking_approved",
    name: "تأیید نوبت آنلاین",
    body: "{{name}} عزیز، درخواست نوبت شما تأیید شد: {{date}} ساعت {{time}} با {{therapist}}.\n{{clinic}}",
    variables: ["name", "date", "time", "therapist", "clinic"],
    patternArgs: ["name", "date", "time", "therapist"],
    description: "پس از تأیید درخواست نوبت سایت توسط منشی ارسال می‌شود.",
  },
  {
    key: "booking_rejected",
    name: "رد نوبت آنلاین",
    body: "{{name}} عزیز، متأسفانه زمان درخواستی شما ({{date}} ساعت {{time}}) در دسترس نیست. لطفاً برای هماهنگی با {{phone}} تماس بگیرید.\n{{clinic}}",
    variables: ["name", "date", "time", "phone", "clinic"],
    patternArgs: ["name", "date", "time", "phone"],
    description: "در صورت رد درخواست نوبت ارسال می‌شود.",
  },
  {
    key: "general",
    name: "الگوی عمومی",
    body: "همراه گرامی {{clinic}}\n{{message}}\nبا تشکر از همراهی شما",
    variables: ["message", "clinic"],
    patternArgs: ["message"],
    description: "برای ارسال هر پیام دلخواه (تکی یا گروهی).",
  },
];

/** جای‌گذاری متغیرها در متن الگو */
export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

export function normalizePhone(input: string): string {
  let p = (input || "").toString().trim();
  p = p.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  p = p.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  p = p.replace(/[^\d+]/g, "");
  if (p.startsWith("+98")) p = "0" + p.slice(3);
  else if (p.startsWith("0098")) p = "0" + p.slice(4);
  else if (p.startsWith("98") && p.length === 12) p = "0" + p.slice(2);
  else if (p.length === 10 && p.startsWith("9")) p = "0" + p;
  return p;
}

export function isValidMobile(p: string): boolean {
  return /^09\d{9}$/.test(p);
}

/** آیا عبارت جستجو شبیه شماره تلفن است؟ (فقط رقم، فاصله، + و -) */
export function isPhoneLike(q: string): boolean {
  const s = toEnglishDigitsLocal(q.trim());
  return /^[\d+\-\s]{4,}$/.test(s);
}

function toEnglishDigitsLocal(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/**
 * تبدیل متن الگوی سایت به متن قابل ثبت در ملی‌پیامک:
 * {{clinic}} با نام کلینیک جایگزین و سایر متغیرها طبق ترتیب patternArgs به {0},{1},... تبدیل می‌شوند.
 */
export function toProviderPattern(body: string, patternArgs: string[], fixed: Record<string, string>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const i = patternArgs.indexOf(k);
    if (i >= 0) return `{${i}}`;
    if (fixed[k] !== undefined) return fixed[k];
    return `{{${k}}}`;
  });
}

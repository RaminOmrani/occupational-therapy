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
  description: string;
}

export const SMS_TEMPLATE_DEFAULTS: SmsTemplateDef[] = [
  {
    key: "otp",
    name: "کد ورود یکبارمصرف",
    body: "کد ورود شما به {{clinic}}: {{code}}\nاین کد تا {{minutes}} دقیقه معتبر است.",
    variables: ["clinic", "code", "minutes"],
    description: "هنگام ورود بیمار با شماره موبایل ارسال می‌شود.",
  },
  {
    key: "welcome",
    name: "خوش‌آمد به بیمار جدید",
    body: "{{name}} عزیز، به {{clinic}} خوش آمدید. شماره پرونده شما: {{fileNumber}}\nبرای مشاهده برنامه جلسات و پرونده خود با همین شماره وارد اپلیکیشن شوید.",
    variables: ["name", "clinic", "fileNumber"],
    description: "پس از ثبت پرونده بیمار ارسال می‌شود.",
  },
  {
    key: "appointment_fixed",
    name: "قطعی‌شدن نوبت",
    body: "{{name}} عزیز، نوبت شما با {{therapist}} در تاریخ {{date}} ساعت {{time}} قطعی شد.\n{{clinic}}",
    variables: ["name", "therapist", "date", "time", "clinic"],
    description: "به‌محض قطعی‌شدن برنامه توسط منشی به بیمار ارسال می‌شود.",
  },
  {
    key: "appointment_fixed_therapist",
    name: "برنامه روزانه درمانگر",
    body: "{{name}} عزیز، برنامه {{date}} شما قطعی شد: {{count}} جلسه، اولین جلسه ساعت {{time}}.\n{{clinic}}",
    variables: ["name", "date", "count", "time", "clinic"],
    description: "پس از قطعی‌شدن برنامه روز به درمانگر ارسال می‌شود.",
  },
  {
    key: "appointment_reminder",
    name: "یادآوری جلسه",
    body: "{{name}} عزیز، یادآوری: جلسه شما با {{therapist}} امروز ساعت {{time}} برگزار می‌شود. لطفاً ۱۰ دقیقه زودتر حضور داشته باشید.\n{{clinic}}",
    variables: ["name", "therapist", "time", "clinic"],
    description: "دو ساعت (قابل تنظیم) قبل از شروع جلسه ارسال می‌شود.",
  },
  {
    key: "appointment_cancelled",
    name: "لغو نوبت",
    body: "{{name}} عزیز، نوبت شما در تاریخ {{date}} ساعت {{time}} لغو شد. برای تعیین نوبت جدید با ما تماس بگیرید.\n{{clinic}}",
    variables: ["name", "date", "time", "clinic"],
    description: "هنگام لغو نوبت ارسال می‌شود.",
  },
  {
    key: "payment_received",
    name: "رسید پرداخت",
    body: "{{name}} عزیز، پرداخت شما به مبلغ {{amount}} {{currency}} ثبت شد. مانده حساب: {{balance}} {{currency}}\n{{clinic}}",
    variables: ["name", "amount", "currency", "balance", "clinic"],
    description: "پس از ثبت پرداخت ارسال می‌شود.",
  },
  {
    key: "debt_reminder",
    name: "یادآوری بدهی",
    body: "{{name}} عزیز، مانده بدهی شما {{balance}} {{currency}} است. لطفاً نسبت به تسویه اقدام فرمایید.\n{{clinic}}",
    variables: ["name", "balance", "currency", "clinic"],
    description: "به‌صورت دستی از پروفایل مالی بیمار ارسال می‌شود.",
  },
  {
    key: "birthday",
    name: "تبریک تولد",
    body: "{{name}} عزیز، تولدتان مبارک! آرزوی سلامتی و شادی برای شما داریم.\n{{clinic}}",
    variables: ["name", "clinic"],
    description: "در روز تولد بیمار (در صورت فعال‌بودن) ارسال می‌شود.",
  },
  {
    key: "lead_followup",
    name: "پیگیری لید",
    body: "{{name}} عزیز، از تماس شما با {{clinic}} سپاسگزاریم. برای رزرو جلسه ارزیابی رایگان با شماره {{phone}} تماس بگیرید.",
    variables: ["name", "clinic", "phone"],
    description: "برای پیگیری سرنخ‌های فروش استفاده می‌شود.",
  },
  {
    key: "general",
    name: "الگوی عمومی",
    body: "{{message}}\n{{clinic}}",
    variables: ["message", "clinic"],
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

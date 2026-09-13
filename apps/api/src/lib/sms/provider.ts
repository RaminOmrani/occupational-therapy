/**
 * آداپتور ملی‌پیامک.
 * دو روش اتصال پشتیبانی می‌شود و از پنل مدیریت انتخاب می‌شود:
 *  - melipayamak-rest:    وب‌سرویس REST با نام کاربری و رمز عبور (rest.payamak-panel.com)
 *  - melipayamak-console: API کنسول جدید با کلید API (console.melipayamak.com)
 *  - mock:                بدون ارسال واقعی؛ فقط در لاگ ثبت می‌شود (مناسب توسعه)
 */
export interface SendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
  raw?: unknown;
}

export interface SmsProviderConfig {
  provider: string;
  username: string;
  password: string;
  apiKey: string;
  from: string;
}

async function postJson(url: string, body: unknown, timeoutMs = 15000): Promise<{ status: number; data: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* متن خام */
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

const REST_BASE = "https://rest.payamak-panel.com/api/SendSMS";
const CONSOLE_BASE = "https://console.melipayamak.com/api";

/** کدهای خطای متداول ملی‌پیامک برای نمایش فارسی */
const REST_STATUS: Record<string, string> = {
  "0": "نام کاربری یا رمز عبور اشتباه است",
  "1": "ارسال شد",
  "2": "اعتبار کافی نیست",
  "3": "محدودیت در ارسال روزانه",
  "4": "محدودیت در حجم ارسال",
  "5": "شماره فرستنده معتبر نیست",
  "6": "سامانه در حال بروزرسانی است",
  "7": "متن حاوی کلمه فیلترشده است",
  "9": "ارسال از خطوط عمومی از طریق وب‌سرویس امکان‌پذیر نیست",
  "10": "کاربر مورد نظر فعال نیست",
  "11": "ارسال نشد",
  "12": "مدارک کاربر کامل نیست",
  "14": "متن حاوی لینک است",
  "15": "ارسال به بیش از یک شماره بدون شماره اختصاصی ممکن نیست",
  "16": "شماره گیرنده‌ای یافت نشد",
  "17": "متن پیامک خالی است",
  "35": "شماره در لیست سیاه است",
};

export async function sendSimple(cfg: SmsProviderConfig, to: string, text: string): Promise<SendResult> {
  try {
    if (cfg.provider === "melipayamak-console") {
      if (!cfg.apiKey) return { ok: false, error: "کلید API تنظیم نشده است" };
      const r = await postJson(`${CONSOLE_BASE}/send/simple/${cfg.apiKey}`, { from: cfg.from, to, text });
      const recId = r.data?.recId;
      if (r.status === 200 && recId && Number(recId) > 1000) return { ok: true, providerId: String(recId), raw: r.data };
      return { ok: false, error: r.data?.status || `خطای ${r.status}`, raw: r.data };
    }
    if (cfg.provider === "melipayamak-rest") {
      if (!cfg.username || !cfg.password) return { ok: false, error: "نام کاربری/رمز ملی‌پیامک تنظیم نشده است" };
      const r = await postJson(`${REST_BASE}/SendSMS`, { username: cfg.username, password: cfg.password, to, from: cfg.from, text, isflash: false });
      const ret = String(r.data?.RetStatus ?? "");
      if (ret === "1") return { ok: true, providerId: String(r.data?.Value ?? ""), raw: r.data };
      return { ok: false, error: REST_STATUS[ret] || r.data?.StrRetStatus || `خطای ${r.status}`, raw: r.data };
    }
    return { ok: false, error: "سرویس پیامک پیکربندی نشده است" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "خطا در اتصال به سرویس پیامک" };
  }
}

/** کدهای خطای سرویس الگو (طبق مستندات SendByBaseNumber2 / BaseServiceNumber) */
const PATTERN_STATUS: Record<string, string> = {
  "-110": "باید به‌جای رمز عبور از ApiKey استفاده شود (تنظیمات امنیتی پنل ملی‌پیامک)",
  "-109": "باید IP مجاز در پنل ملی‌پیامک تنظیم شود (IP سرور را در پنل ثبت کنید)",
  "-108": "IP سرور به‌دلیل تلاش ناموفق مسدود شده است",
  "-10": "ارسال لینک در متغیرهای الگو ممنوع است",
  "-6": "خطای داخلی ملی‌پیامک",
  "-5": "تعداد/ترتیب متغیرها با الگوی ثبت‌شده همخوانی ندارد",
  "-4": "کد الگو اشتباه است یا هنوز تأیید نشده",
  "-3": "خط ارسالی در سیستم تعریف نشده است",
  "-2": "هر بار فقط یک شماره مجاز است",
  "-1": "دسترسی وب‌سرویس غیرفعال است؛ با پشتیبانی ملی‌پیامک تماس بگیرید",
  "0": "نام کاربری یا رمز عبور اشتباه است",
  "2": "اعتبار کافی نیست",
  "6": "سامانه در حال به‌روزرسانی است",
  "7": "متن حاوی کلمه فیلترشده است",
  "10": "کاربر فعال نیست",
  "11": "ارسال نشد",
  "12": "مدارک کاربر کامل نیست",
  "18": "شماره موبایل معتبر نیست",
  "19": "سقف ارسال روزانه وب‌سرویس پر شده است",
};

async function postForm(url: string, params: Record<string, string>, timeoutMs = 15000): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString(), signal: ctrl.signal });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

/** ارسال با الگوی تأییدشده (خدماتی). args به ترتیب متغیرهای الگو */
export async function sendPattern(cfg: SmsProviderConfig, to: string, bodyId: string, args: string[]): Promise<SendResult> {
  try {
    if (cfg.provider === "melipayamak-console") {
      if (!cfg.apiKey) return { ok: false, error: "کلید API تنظیم نشده است" };
      const r = await postJson(`${CONSOLE_BASE}/send/shared/${cfg.apiKey}`, { bodyId: Number(bodyId), to, args });
      const recId = r.data?.recId;
      if (r.status === 200 && recId && Number(recId) > 1000) return { ok: true, providerId: String(recId), raw: r.data };
      return { ok: false, error: r.data?.status || `خطای ${r.status}`, raw: r.data };
    }
    if (cfg.provider === "melipayamak-rest") {
      if (!cfg.username || !cfg.password) return { ok: false, error: "نام کاربری/رمز ملی‌پیامک تنظیم نشده است" };
      // متغیرها با ; از هم جدا می‌شوند (SendByBaseNumber2 طبق مستندات خط خدماتی اشتراکی)
      const text = args.join(";");
      try {
        const r = await postForm("https://api.payamak-panel.com/post/Send.asmx/SendByBaseNumber2", { username: cfg.username, password: cfg.password, text, to, bodyId: String(Number(bodyId)) });
        const m = r.text.match(/<string[^>]*>([^<]*)<\/string>/);
        const val = (m?.[1] ?? r.text).trim();
        if (/^\d{15,}$/.test(val)) return { ok: true, providerId: val, raw: r.text };
        if (/^-?\d+$/.test(val)) return { ok: false, error: PATTERN_STATUS[val] || `کد خطای ${val}`, raw: r.text };
      } catch {
        /* به سرویس REST برمی‌گردیم */
      }
      const r = await postJson(`${REST_BASE}/BaseServiceNumber`, { username: cfg.username, password: cfg.password, text, to, bodyId: Number(bodyId) });
      const val = String(r.data?.Value ?? "");
      const ret = String(r.data?.RetStatus ?? "");
      if (/^\d{15,}$/.test(val) || ret === "1") return { ok: true, providerId: val, raw: r.data };
      return { ok: false, error: PATTERN_STATUS[val] || REST_STATUS[ret] || r.data?.StrRetStatus || `خطای ${r.status}`, raw: r.data };
    }
    return { ok: false, error: "سرویس پیامک پیکربندی نشده است" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "خطا در اتصال به سرویس پیامک" };
  }
}

export async function getCredit(cfg: SmsProviderConfig): Promise<{ ok: boolean; credit?: number; error?: string }> {
  try {
    if (cfg.provider === "melipayamak-console") {
      const res = await fetch(`${CONSOLE_BASE}/receive/credit/${cfg.apiKey}`);
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.amount !== undefined) return { ok: true, credit: Number(data.amount) };
      return { ok: false, error: data?.status || `خطای ${res.status}` };
    }
    if (cfg.provider === "melipayamak-rest") {
      const r = await postJson(`${REST_BASE}/GetCredit`, { username: cfg.username, password: cfg.password });
      if (String(r.data?.RetStatus) === "1") return { ok: true, credit: Number(r.data?.Value) };
      return { ok: false, error: REST_STATUS[String(r.data?.RetStatus)] || "خطا در دریافت اعتبار" };
    }
    return { ok: true, credit: 0 };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

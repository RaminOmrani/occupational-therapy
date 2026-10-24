/**
 * درگاه زیبال (https://help.zibal.ir/ipg). مبالغ به «ریال» ارسال می‌شوند؛ کلینیک به تومان کار می‌کند (× ۱۰).
 * حالت آزمایشی با merchant = "zibal" (حساب تستی خود زیبال) کار می‌کند.
 */
export interface ZibalConfig { merchant: string; sandbox: boolean }

const BASE = "https://gateway.zibal.ir";
const merchantOf = (c: ZibalConfig) => (c.sandbox ? "zibal" : c.merchant);
export const zibalStartUrl = (trackId: string) => `${BASE}/start/${trackId}`;

const REQUEST_ERRORS: Record<number, string> = {
  102: "مرچنت زیبال یافت نشد", 103: "مرچنت زیبال غیرفعال است یا قرارداد درگاه امضا نشده", 104: "مرچنت زیبال نامعتبر است",
  105: "مبلغ باید بیشتر از ۱۰۰ تومان باشد", 106: "آدرس بازگشت نامعتبر است", 113: "مبلغ از سقف تراکنش بیشتر است",
  115: "IP سرور در پنل زیبال ثبت نشده است",
};
const VERIFY_ERRORS: Record<number, string> = { 102: "مرچنت یافت نشد", 103: "مرچنت غیرفعال", 104: "مرچنت نامعتبر", 202: "سفارش پرداخت نشده یا ناموفق بوده است", 203: "شناسه تراکنش نامعتبر است" };

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({}))) as any;
}

/** amountToman به تومان است */
export async function zibalRequest(c: ZibalConfig, p: { amountToman: number; description: string; callbackUrl: string; mobile?: string; orderId: string }): Promise<{ ok: boolean; trackId?: string; error?: string }> {
  try {
    const r = await post("/v1/request", { merchant: merchantOf(c), amount: p.amountToman * 10, callbackUrl: p.callbackUrl, description: p.description, orderId: p.orderId, mobile: p.mobile });
    if (r?.result === 100 && r.trackId) return { ok: true, trackId: String(r.trackId) };
    return { ok: false, error: REQUEST_ERRORS[r?.result] || r?.message || "خطا در ایجاد تراکنش زیبال" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "خطا در اتصال به زیبال" };
  }
}

/** تأیید تراکنش؛ مبلغ پرداخت‌شده (ریال) باید با مبلغ درخواست برابر باشد */
export async function zibalVerify(c: ZibalConfig, p: { trackId: string; amountToman: number }): Promise<{ ok: boolean; refId?: string; error?: string; alreadyVerified?: boolean }> {
  try {
    const r = await post("/v1/verify", { merchant: merchantOf(c), trackId: Number(p.trackId) || p.trackId });
    if (r?.result === 100 || r?.result === 201) {
      if (typeof r.amount === "number" && r.amount !== p.amountToman * 10) return { ok: false, error: "مبلغ پرداخت‌شده با مبلغ درخواست برابر نیست" };
      return { ok: true, refId: String(r.refNumber ?? p.trackId), alreadyVerified: r.result === 201 };
    }
    return { ok: false, error: VERIFY_ERRORS[r?.result] || r?.message || "پرداخت تأیید نشد" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "خطا در اتصال به زیبال" };
  }
}

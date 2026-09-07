/**
 * درگاه زرین‌پال (API نسخه ۴). با تنظیم payment.sandbox=true از محیط آزمایشی استفاده می‌شود.
 * مبالغ به تومان ارسال می‌شوند (currency: IRT).
 */
export interface ZarinpalConfig { merchantId: string; sandbox: boolean }

const base = (c: ZarinpalConfig) => (c.sandbox ? "https://sandbox.zarinpal.com/pg/v4/payment" : "https://payment.zarinpal.com/pg/v4/payment");
export const startPayUrl = (c: ZarinpalConfig, authority: string) => `${c.sandbox ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com"}/pg/StartPay/${authority}`;

const ERRORS: Record<string, string> = {
  "-9": "خطای اعتبارسنجی (مبلغ یا مرچنت)", "-10": "مرچنت آی‌دی نامعتبر است", "-11": "مرچنت فعال نیست", "-12": "تلاش بیش از حد", "-15": "درگاه معلق است", "-16": "سطح تأیید پذیرنده پایین‌تر از نقره‌ای است",
  "-50": "مبلغ پرداخت‌شده با مبلغ درخواست مطابقت ندارد", "-51": "پرداخت ناموفق", "-53": "اتوریتی برای این مرچنت نیست", "-54": "اتوریتی نامعتبر است", "101": "قبلاً تأیید شده",
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({}))) as any;
}

export async function zpRequest(c: ZarinpalConfig, p: { amount: number; description: string; callbackUrl: string; mobile?: string }): Promise<{ ok: boolean; authority?: string; error?: string }> {
  try {
    const r = await post(`${base(c)}/request.json`, { merchant_id: c.merchantId, amount: p.amount, currency: "IRT", description: p.description, callback_url: p.callbackUrl, metadata: p.mobile ? { mobile: p.mobile } : undefined });
    if (r?.data?.code === 100 && r.data.authority) return { ok: true, authority: r.data.authority };
    const code = String(r?.errors?.code ?? r?.data?.code ?? "");
    return { ok: false, error: ERRORS[code] || r?.errors?.message || "خطا در ایجاد تراکنش" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "خطا در اتصال به درگاه" };
  }
}

export async function zpVerify(c: ZarinpalConfig, p: { amount: number; authority: string }): Promise<{ ok: boolean; refId?: string; error?: string; alreadyVerified?: boolean }> {
  try {
    const r = await post(`${base(c)}/verify.json`, { merchant_id: c.merchantId, amount: p.amount, currency: "IRT", authority: p.authority });
    const code = r?.data?.code ?? r?.errors?.code;
    if (code === 100) return { ok: true, refId: String(r.data.ref_id) };
    if (code === 101) return { ok: true, refId: String(r.data.ref_id ?? ""), alreadyVerified: true };
    return { ok: false, error: ERRORS[String(code)] || r?.errors?.message || "پرداخت تأیید نشد" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "خطا در اتصال به درگاه" };
  }
}

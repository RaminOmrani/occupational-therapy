import { SMS_TEMPLATE_DEFAULTS, normalizePhone, renderTemplate, isValidMobile } from "@toranj/shared";
import { prisma, parseJson } from "../prisma.js";
import { getSetting, getSettingBool } from "../settings.js";
import { sendPattern, sendSimple, type SmsProviderConfig } from "./provider.js";

export async function ensureDefaultTemplates() {
  for (const t of SMS_TEMPLATE_DEFAULTS) {
    await prisma.smsTemplate.upsert({
      where: { key: t.key },
      create: { key: t.key, name: t.name, body: t.body, variables: JSON.stringify(t.variables), patternArgs: JSON.stringify(t.patternArgs), isSystem: true, description: t.description },
      update: { isSystem: true, description: t.description, variables: JSON.stringify(t.variables) },
    });
    // اگر ترتیب متغیرهای الگو هنوز تنظیم نشده، پیش‌فرض را بگذار
    await prisma.smsTemplate.updateMany({ where: { key: t.key, patternArgs: null }, data: { patternArgs: JSON.stringify(t.patternArgs) } }).catch(() => null);
    // مهاجرت: الگوی رضایت‌سنجی قدیمی با لینک کامل → نسخه بدون لینک در متغیر
    if (t.key === "survey") await prisma.smsTemplate.updateMany({ where: { key: "survey", body: { contains: "{{link}}" } }, data: { body: t.body, variables: JSON.stringify(t.variables), patternArgs: JSON.stringify(t.patternArgs) } }).catch(() => null);
  }
}

export async function getProviderConfig(): Promise<SmsProviderConfig> {
  return {
    provider: await getSetting("sms.provider", "mock"),
    username: await getSetting("sms.username"),
    password: await getSetting("sms.password"),
    apiKey: await getSetting("sms.apiKey"),
    from: await getSetting("sms.from"),
  };
}

interface SendOptions {
  related?: { type: string; id: string };
  campaignId?: string;
}

/** ارسال پیام متنی خام (بدون الگو) و ثبت لاگ */
export async function sendRawSms(to: string, body: string, opts: SendOptions & { templateKey?: string } = {}) {
  const phone = normalizePhone(to);
  const log = await prisma.smsLog.create({
    data: {
      to: phone,
      body,
      templateKey: opts.templateKey ?? null,
      relatedType: opts.related?.type ?? null,
      relatedId: opts.related?.id ?? null,
      campaignId: opts.campaignId ?? null,
      status: "PENDING",
    },
  });
  if (!isValidMobile(phone)) {
    return prisma.smsLog.update({ where: { id: log.id }, data: { status: "FAILED", error: "شماره موبایل نامعتبر است" } });
  }
  const cfg = await getProviderConfig();
  if (cfg.provider === "mock") {
    console.log(`[SMS:mock] -> ${phone}\n${body}\n`);
    return prisma.smsLog.update({ where: { id: log.id }, data: { status: "MOCK", provider: "mock" } });
  }
  const r = await sendSimple(cfg, phone, body);
  return prisma.smsLog.update({
    where: { id: log.id },
    data: { status: r.ok ? "SENT" : "FAILED", provider: cfg.provider, providerId: r.providerId ?? null, error: r.error ?? null },
  });
}

/** ارسال بر اساس الگوی ذخیره‌شده در دیتابیس؛ در صورت داشتن کد الگو و فعال‌بودن، از سرویس الگو استفاده می‌شود */
export async function sendTemplateSms(templateKey: string, to: string, vars: Record<string, string | number | null | undefined>, opts: SendOptions = {}) {
  const tpl = await prisma.smsTemplate.findUnique({ where: { key: templateKey } });
  const clinic = await getSetting("sms.signature", await getSetting("clinic.name"));
  const siteHost = (await getSetting("site.baseUrl", "")).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const allVars: Record<string, string | number | null | undefined> = { clinic, currency: await getSetting("finance.currency", "تومان"), siteHost, ...vars };
  if (!tpl || !tpl.isActive) {
    const def = SMS_TEMPLATE_DEFAULTS.find((t) => t.key === templateKey);
    if (!def) throw new Error(`الگوی پیامک «${templateKey}» یافت نشد`);
    return sendRawSms(to, renderTemplate(def.body, allVars), { ...opts, templateKey });
  }
  const body = renderTemplate(tpl.body, allVars);
  const usePatterns = await getSettingBool("sms.usePatterns", true);
  const sharedLine = await getSettingBool("sms.sharedLine", true);
  const cfg = await getProviderConfig();
  if (cfg.provider !== "mock" && sharedLine && !tpl.patternCode) {
    // خط خدماتی اشتراکی فقط الگوی تأییدشده می‌فرستد
    return prisma.smsLog.create({
      data: { to: normalizePhone(to), body, templateKey, relatedType: opts.related?.type ?? null, relatedId: opts.related?.id ?? null, campaignId: opts.campaignId ?? null, status: "FAILED", provider: cfg.provider, error: `الگوی «${tpl.name}» کد الگوی ملی‌پیامک ندارد؛ در بخش پیامک ← الگوها ثبت کنید` },
    });
  }
  if (usePatterns && tpl.patternCode && cfg.provider !== "mock") {
    const phone = normalizePhone(to);
    const order = parseJson<string[]>(tpl.patternArgs ?? "null", []).length ? parseJson<string[]>(tpl.patternArgs ?? "[]", []) : parseJson<string[]>(tpl.variables, []).filter((v) => v !== "clinic");
    const args = order.map((v) => String(allVars[v] ?? "").replace(/;/g, "،"));
    const log = await prisma.smsLog.create({
      data: { to: phone, body, templateKey, relatedType: opts.related?.type ?? null, relatedId: opts.related?.id ?? null, campaignId: opts.campaignId ?? null, status: "PENDING" },
    });
    const r = await sendPattern(cfg, phone, tpl.patternCode, args);
    return prisma.smsLog.update({
      where: { id: log.id },
      data: { status: r.ok ? "SENT" : "FAILED", provider: `${cfg.provider}:pattern`, providerId: r.providerId ?? null, error: r.error ?? null },
    });
  }
  return sendRawSms(to, body, { ...opts, templateKey });
}

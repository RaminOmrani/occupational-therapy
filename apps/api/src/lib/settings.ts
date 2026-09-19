import { DEFAULT_SETTINGS } from "@toranj/shared";
import { prisma } from "./prisma.js";

/**
 * تنظیمات در دیتابیس ذخیره می‌شوند (نه env) و از پنل مدیریت قابل تغییرند.
 * برای کارایی، در حافظه کش می‌شوند و با هر تغییر کش نو می‌شود.
 */
const cache = new Map<string, string>();
let loaded = false;

export async function ensureDefaultSettings() {
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: def.value, group: def.group, label: def.label, description: def.description, type: def.type, secret: !!def.secret },
      update: { group: def.group, label: def.label, description: def.description, type: def.type, secret: !!def.secret },
    });
  }
  await migrateSettings();
  await reloadSettings();
}

/** به‌روزرسانی یک‌باره‌ی مقادیر قدیمی که هنوز دست نخورده‌اند (تغییر برند و ساعت کاری) */
const VALUE_MIGRATIONS: { key: string; from: string; to: string }[] = [
  { key: "schedule.endHour", from: "20", to: "22" },
  { key: "clinic.name", from: "کلینیک کاردرمانی ذهن سبز", to: DEFAULT_SETTINGS["clinic.name"].value },
];
async function migrateSettings() {
  for (const m of VALUE_MIGRATIONS) {
    await prisma.setting.updateMany({ where: { key: m.key, value: m.from }, data: { value: m.to } });
  }
  const rows = await prisma.setting.findMany({ where: { OR: [{ group: "clinic" }, { group: "public" }, { group: "consent" }, { group: "booking" }, { group: "sms" }] } });
  for (const r of rows) {
    const v = r.value.replace(/کاردرمانی/g, "توان‌بخشی").replace(/بیماران/g, "مراجعین").replace(/بیمار(?!ی)/g, "مراجع");
    if (v !== r.value) await prisma.setting.update({ where: { key: r.key }, data: { value: v } });
  }
}

export async function reloadSettings() {
  const rows = await prisma.setting.findMany();
  cache.clear();
  for (const r of rows) cache.set(r.key, r.value);
  loaded = true;
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  if (!loaded) await reloadSettings();
  if (cache.has(key)) return cache.get(key) as string;
  return DEFAULT_SETTINGS[key]?.value ?? fallback;
}

export async function getSettingNumber(key: string, fallback = 0): Promise<number> {
  const v = Number(await getSetting(key, String(fallback)));
  return isNaN(v) ? fallback : v;
}

export async function getSettingBool(key: string, fallback = false): Promise<boolean> {
  const v = (await getSetting(key, fallback ? "true" : "false")).toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export async function getSettingJson<T>(key: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await getSetting(key, JSON.stringify(fallback))) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: string) {
  const def = DEFAULT_SETTINGS[key];
  await prisma.setting.upsert({
    where: { key },
    create: { key, value, group: def?.group ?? "general", label: def?.label, description: def?.description, type: def?.type ?? "text", secret: !!def?.secret },
    update: { value },
  });
  cache.set(key, value);
}

export async function getAllSettings(includeSecrets = false) {
  const rows = await prisma.setting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
  return rows.map((r) => ({
    ...r,
    value: r.secret && !includeSecrets ? (r.value ? "••••••••" : "") : r.value,
    options: DEFAULT_SETTINGS[r.key]?.options,
  }));
}

/** تنظیمات عمومی که سایت بدون ورود می‌بیند */
export async function getPublicSettings() {
  const keys = Object.keys(DEFAULT_SETTINGS).filter((k) => k.startsWith("clinic.") || k.startsWith("public.") || k.startsWith("schedule.") || k.startsWith("booking.") || k.startsWith("finance.") || k.startsWith("app.") || k === "payment.provider" || k === "crm.birthdayDaysAhead" || k === "site.baseUrl");
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = await getSetting(k);
  return out;
}

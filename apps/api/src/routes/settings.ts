import { Router } from "express";
import { z } from "zod";
import { DEFAULT_SETTINGS } from "@toranj/shared";
import { getAllSettings, setSetting, getPublicSettings } from "../lib/settings.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";
import { audit } from "../lib/audit.js";
import { sendRawSms } from "../lib/sms/service.js";
import { normalizePhone } from "@toranj/shared";

export const settingsRouter = Router();

settingsRouter.get("/public", async (_req, res) => {
  res.json({ settings: await getPublicSettings() });
});

settingsRouter.use(requireAuth, requireAdmin);

settingsRouter.get("/", async (_req, res) => {
  const items = await getAllSettings(false);
  const groups: Record<string, string> = { clinic: "اطلاعات کلینیک", public: "سایت عمومی", schedule: "نوبت‌دهی", finance: "مالی", crm: "CRM", sms: "پیامک", security: "امنیت", general: "عمومی" };
  res.json({ items: items.filter((i) => i.key !== "security.jwtSecret"), groups });
});

settingsRouter.put("/", async (req, res) => {
  const body = validate(z.object({ values: z.record(z.string(), z.string()) }), req.body);
  const changed: string[] = [];
  for (const [key, value] of Object.entries(body.values)) {
    if (key === "security.jwtSecret") continue;
    if (DEFAULT_SETTINGS[key]?.secret && value === "••••••••") continue; // بدون تغییر
    if (DEFAULT_SETTINGS[key]?.type === "json") {
      try {
        JSON.parse(value);
      } catch {
        return res.status(400).json({ message: `مقدار «${DEFAULT_SETTINGS[key].label}» باید JSON معتبر باشد` });
      }
    }
    await setSetting(key, value);
    changed.push(key);
  }
  await audit(req.user!.id, "update", "settings", null, { changed });
  res.json({ ok: true, changed });
});

/** ارسال پیامک آزمایشی برای بررسی تنظیمات */
settingsRouter.post("/sms-test", async (req, res) => {
  const body = validate(z.object({ to: z.string().min(10) }), req.body);
  const log = await sendRawSms(normalizePhone(body.to), "پیامک آزمایشی سامانه کلینیک با موفقیت ارسال شد.", { templateKey: "test" });
  res.json({ log });
});

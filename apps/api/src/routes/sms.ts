import { Router } from "express";
import { z } from "zod";
import { normalizePhone, isValidMobile, daysUntilBirthday, renderTemplate, toProviderPattern } from "@toranj/shared";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zOptionalString } from "../lib/validate.js";
import { badRequest, notFound } from "../lib/errors.js";
import { requireAuth, requireRole, requireAdminOrSecretary } from "../middleware/auth.js";
import { getProviderConfig, sendRawSms, sendTemplateSms } from "../lib/sms/service.js";
import { getCredit } from "../lib/sms/provider.js";
import { getSetting } from "../lib/settings.js";
import { patientFinancialSummary } from "../lib/finance.js";
import { audit } from "../lib/audit.js";

export const smsRouter = Router();
smsRouter.use(requireAuth, requireAdminOrSecretary);

// ---------- الگوها ----------
smsRouter.get("/templates", async (_req, res) => {
  const items = await prisma.smsTemplate.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  const fixed = { clinic: await getSetting("sms.signature", await getSetting("clinic.name")), currency: await getSetting("finance.currency", "تومان"), siteHost: (await getSetting("site.baseUrl", "")).replace(/^https?:\/\//, "").replace(/\/$/, "") };
  res.json({
    items: items.map((t) => {
      const variables = parseJson<string[]>(t.variables, []);
      const patternArgs = parseJson<string[]>(t.patternArgs ?? "null", []).length ? parseJson<string[]>(t.patternArgs ?? "[]", []) : variables.filter((v) => v !== "clinic");
      return { ...t, variables, patternArgs, providerText: toProviderPattern(t.body, patternArgs, fixed) };
    }),
  });
});
smsRouter.post("/templates", requireRole("ADMIN"), async (req, res) => {
  const body = validate(z.object({ key: z.string().regex(/^[a-z0-9_]+$/, "کلید فقط حروف کوچک انگلیسی، عدد و _"), name: z.string().min(1), body: z.string().min(1), patternCode: zOptionalString, patternArgs: z.array(z.string()).optional(), description: zOptionalString }), req.body);
  const variables = [...new Set([...body.body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];
  const { patternArgs, ...rest } = body;
  const t = await prisma.smsTemplate.create({ data: { ...rest, variables: JSON.stringify(variables), patternArgs: JSON.stringify(patternArgs ?? variables.filter((v) => v !== "clinic")), isSystem: false } });
  res.status(201).json({ template: { ...t, variables } });
});
smsRouter.patch("/templates/:id", requireRole("ADMIN"), async (req, res) => {
  const body = validate(z.object({ name: z.string().optional(), body: z.string().optional(), patternCode: zOptionalString, patternArgs: z.array(z.string()).optional(), isActive: z.boolean().optional(), description: zOptionalString }), req.body);
  const cur = await prisma.smsTemplate.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound();
  const data: any = { ...body };
  if (body.patternArgs) data.patternArgs = JSON.stringify(body.patternArgs);
  if (body.body && !cur.isSystem) data.variables = JSON.stringify([...new Set([...body.body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))]);
  const t = await prisma.smsTemplate.update({ where: { id: cur.id }, data });
  res.json({ template: { ...t, variables: parseJson<string[]>(t.variables, []) } });
});
smsRouter.delete("/templates/:id", requireRole("ADMIN"), async (req, res) => {
  const cur = await prisma.smsTemplate.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound();
  if (cur.isSystem) throw badRequest("الگوهای سیستمی قابل حذف نیستند؛ می‌توانید غیرفعال کنید");
  await prisma.smsTemplate.delete({ where: { id: cur.id } });
  res.json({ ok: true });
});

/** پیش‌نمایش الگو با داده نمونه */
smsRouter.post("/templates/preview", async (req, res) => {
  const body = validate(z.object({ body: z.string(), vars: z.record(z.string(), z.any()).optional() }), req.body);
  const clinic = await getSetting("sms.signature", await getSetting("clinic.name"));
  res.json({ text: renderTemplate(body.body, { clinic, name: "علی رضایی", therapist: "خانم دکتر محمدی", date: "۱۵ شهریور ۱۴۰۳", time: "۱۰:۳۰", code: "۱۲۳۴۵۶", minutes: 5, amount: "۵۰۰,۰۰۰", balance: "۱,۲۰۰,۰۰۰", currency: "تومان", fileNumber: "OT-00012", count: 6, phone: await getSetting("clinic.phone"), message: "متن پیام شما", ...(body.vars ?? {}) }) });
});

// ---------- وضعیت سرویس ----------
smsRouter.get("/status", async (_req, res) => {
  const cfg = await getProviderConfig();
  const credit = cfg.provider === "mock" ? { ok: true, credit: null } : await getCredit(cfg);
  const [total, sent, failed, today] = await Promise.all([
    prisma.smsLog.count(),
    prisma.smsLog.count({ where: { status: "SENT" } }),
    prisma.smsLog.count({ where: { status: "FAILED" } }),
    prisma.smsLog.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);
  res.json({ provider: cfg.provider, from: cfg.from, configured: cfg.provider !== "mock" && (!!cfg.apiKey || (!!cfg.username && !!cfg.password)), credit, stats: { total, sent, failed, today } });
});

// ---------- لاگ ----------
smsRouter.get("/logs", async (req, res) => {
  const where: any = {};
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.templateKey) where.templateKey = String(req.query.templateKey);
  if (req.query.q) where.OR = [{ to: { contains: normalizePhone(String(req.query.q)) } }, { body: { contains: String(req.query.q) } }];
  if (req.query.campaignId) where.campaignId = String(req.query.campaignId);
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = 50;
  const [items, total] = await Promise.all([
    prisma.smsLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.smsLog.count({ where }),
  ]);
  res.json({ items, total, page, pageSize });
});

// ---------- ارسال تکی ----------
smsRouter.post("/send", async (req, res) => {
  const body = validate(z.object({ to: z.string().min(10), message: z.string().min(1).optional(), templateKey: z.string().optional(), vars: z.record(z.string(), z.any()).optional(), patientId: zOptionalString }), req.body);
  const to = normalizePhone(body.to);
  if (!isValidMobile(to)) throw badRequest("شماره موبایل معتبر نیست");
  const related = body.patientId ? { type: "patient", id: body.patientId } : undefined;
  const log = body.templateKey
    ? await sendTemplateSms(body.templateKey, to, body.vars ?? {}, { related })
    : await sendTemplateSms("general", to, { message: body.message ?? "" }, { related });
  await audit(req.user!.id, "sms", "sms", log.id, { to });
  res.json({ log });
});

/** فیلترهای گیرندگان گروهی */
const recipientFilter = z.object({
  audience: z.enum(["patients", "leads", "custom"]).default("patients"),
  status: z.string().optional(),
  therapistId: z.string().optional(),
  gender: z.string().optional(),
  birthdayWithin: z.number().int().optional(),
  debt: z.enum(["debtor", "settled", "credit"]).optional(),
  tag: z.string().optional(),
  ageMin: z.number().int().optional(),
  ageMax: z.number().int().optional(),
  lastVisitDays: z.number().int().optional(),
  leadStatus: z.string().optional(),
  leadSource: z.string().optional(),
  phones: z.array(z.string()).optional(),
  patientIds: z.array(z.string()).optional(),
});

export async function resolveRecipients(f: z.infer<typeof recipientFilter>) {
  if (f.audience === "custom") {
    return (f.phones ?? []).map(normalizePhone).filter(isValidMobile).map((phone) => ({ phone, name: "", type: "custom", id: phone }));
  }
  if (f.audience === "leads") {
    const where: any = {};
    if (f.leadStatus) where.status = f.leadStatus;
    if (f.leadSource) where.source = f.leadSource;
    const leads = await prisma.lead.findMany({ where });
    return leads.map((l) => ({ phone: l.phone, name: `${l.firstName} ${l.lastName}`.trim(), type: "lead", id: l.id }));
  }
  const where: any = {};
  if (f.patientIds?.length) where.id = { in: f.patientIds };
  if (f.status) where.status = f.status;
  else where.status = { not: "ARCHIVED" };
  if (f.therapistId) where.primaryTherapistId = f.therapistId;
  if (f.gender) where.gender = f.gender;
  let patients = await prisma.patient.findMany({ where, include: { appointments: { where: { status: "DONE" }, orderBy: { startAt: "desc" }, take: 1 } } });
  if (f.tag) patients = patients.filter((p) => parseJson<string[]>(p.tags, []).includes(f.tag!));
  if (f.birthdayWithin !== undefined) patients = patients.filter((p) => { const d = daysUntilBirthday(p.birthDate); return d !== null && d <= f.birthdayWithin!; });
  if (f.ageMin !== undefined || f.ageMax !== undefined) {
    patients = patients.filter((p) => {
      if (!p.birthDate) return false;
      const age = (Date.now() - p.birthDate.getTime()) / (365.25 * 86400000);
      return (f.ageMin === undefined || age >= f.ageMin) && (f.ageMax === undefined || age <= f.ageMax);
    });
  }
  if (f.lastVisitDays !== undefined) {
    const cutoff = Date.now() - f.lastVisitDays * 86400000;
    patients = patients.filter((p) => !p.appointments[0] || p.appointments[0].startAt.getTime() < cutoff);
  }
  if (f.debt) {
    const withFin = await Promise.all(patients.map(async (p) => ({ p, fin: await patientFinancialSummary(p.id) })));
    patients = withFin.filter(({ fin }) => (f.debt === "debtor" ? fin.balance > 0 : f.debt === "credit" ? fin.balance < 0 : fin.balance <= 0)).map(({ p }) => p);
  }
  return patients.map((p) => ({ phone: p.phone, name: `${p.firstName} ${p.lastName}`, type: "patient", id: p.id }));
}

/** پیش‌نمایش گیرندگان فیلترشده */
smsRouter.post("/recipients", async (req, res) => {
  const f = validate(recipientFilter, req.body);
  const items = await resolveRecipients(f);
  res.json({ items, count: items.length });
});

/** ارسال گروهی به گیرندگان فیلترشده؛ {{name}} در متن با نام هر گیرنده جایگزین می‌شود */
smsRouter.post("/campaigns", async (req, res) => {
  const body = validate(z.object({ name: z.string().min(1, "نام کمپین الزامی است"), message: z.string().min(1, "متن پیام الزامی است"), filters: recipientFilter, templateKey: z.string().optional() }), req.body);
  const recipients = await resolveRecipients(body.filters);
  if (!recipients.length) throw badRequest("گیرنده‌ای با این فیلتر یافت نشد");
  const unique = new Map(recipients.map((r) => [r.phone, r]));
  const campaign = await prisma.smsCampaign.create({ data: { name: body.name, body: body.message, filters: JSON.stringify(body.filters), total: unique.size, createdById: req.user!.id } });
  res.status(202).json({ campaign, total: unique.size });
  // ارسال در پس‌زمینه تا پاسخ سریع برگردد
  (async () => {
    let sent = 0;
    let failed = 0;
    for (const r of unique.values()) {
      try {
        const log = body.templateKey
          ? await sendTemplateSms(body.templateKey, r.phone, { name: r.name, message: body.message }, { related: { type: r.type, id: r.id }, campaignId: campaign.id })
          : await sendTemplateSms("general", r.phone, { message: renderTemplate(body.message, { name: r.name }) }, { related: { type: r.type, id: r.id }, campaignId: campaign.id });
        if (log.status === "FAILED") failed += 1;
        else sent += 1;
      } catch {
        failed += 1;
      }
      await prisma.smsCampaign.update({ where: { id: campaign.id }, data: { sent, failed } });
    }
  })().catch(console.error);
});

smsRouter.get("/campaigns", async (_req, res) => {
  const items = await prisma.smsCampaign.findMany({ orderBy: { createdAt: "desc" }, include: { createdBy: { select: { firstName: true, lastName: true } } }, take: 100 });
  res.json({ items: items.map((c) => ({ ...c, filters: parseJson(c.filters, {}) })) });
});

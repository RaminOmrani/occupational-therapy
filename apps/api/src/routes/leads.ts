import { Router } from "express";
import { z } from "zod";
import { normalizePhone, isValidMobile, isPhoneLike, LEAD_STATUSES, LEAD_SOURCES } from "@toranj/shared";
import { prisma } from "../lib/prisma.js";
import { validate, zOptionalDate, zOptionalString } from "../lib/validate.js";
import { badRequest, notFound } from "../lib/errors.js";
import { nextNumber } from "../lib/numbering.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { sendTemplateSms, sendRawSms } from "../lib/sms/service.js";
import { getSetting } from "../lib/settings.js";
import { audit } from "../lib/audit.js";

export const leadsRouter = Router();
leadsRouter.use(requireAuth, requireStaff);

const leadSchema = z.object({
  firstName: z.string().min(1, "نام الزامی است"),
  lastName: z.string().min(1, "نام خانوادگی الزامی است"),
  phone: z.string().min(10, "شماره تماس الزامی است"),
  source: z.enum(LEAD_SOURCES).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  interest: zOptionalString,
  notes: zOptionalString,
  followUpAt: zOptionalDate.optional(),
  assignedToId: zOptionalString,
});

const include = { assignedTo: { select: { id: true, firstName: true, lastName: true } }, patient: { select: { id: true, fileNumber: true } } } as const;

leadsRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const status = String(req.query.status ?? "");
  const source = String(req.query.source ?? "");
  const where: any = {};
  if (q) {
    where.OR = [{ firstName: { contains: q } }, { lastName: { contains: q } }, { leadNumber: { contains: q } }];
    if (isPhoneLike(q)) where.OR.push({ phone: { contains: normalizePhone(q) } });
  }
  if (status) where.status = status;
  if (source) where.source = source;
  if (req.query.followUpDue === "1") where.followUpAt = { lte: new Date() };
  const items = await prisma.lead.findMany({ where, include, orderBy: { createdAt: "desc" } });
  const counts = await prisma.lead.groupBy({ by: ["status"], _count: { _all: true } });
  res.json({ items: items.map((l) => ({ ...l, fullName: `${l.firstName} ${l.lastName}` })), counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) });
});

/** ثبت سریع فقط با شماره موبایل (پنل مدیریت) */
leadsRouter.post("/quick", async (req, res) => {
  const body = validate(z.object({ phone: z.string().min(10), firstName: z.string().optional(), lastName: z.string().optional(), source: z.enum(LEAD_SOURCES).optional() }), req.body);
  const phone = normalizePhone(body.phone);
  if (!isValidMobile(phone)) throw badRequest("شماره موبایل معتبر نیست");
  const existingPatient = await prisma.patient.findFirst({ where: { phone } });
  if (existingPatient) throw badRequest(`این شماره قبلاً به‌عنوان بیمار (${existingPatient.fileNumber}) ثبت شده است`);
  const existingLead = await prisma.lead.findFirst({ where: { phone, status: { not: "LOST" } } });
  if (existingLead) return res.json({ lead: existingLead, existed: true });
  const lead = await prisma.lead.create({
    data: { leadNumber: await nextNumber("lead", "L-"), phone, firstName: body.firstName || "ناشناس", lastName: body.lastName || "", source: body.source ?? "PHONE", assignedToId: req.user!.id },
    include,
  });
  await prisma.leadActivity.create({ data: { leadId: lead.id, type: "STATUS", content: "ثبت سریع با شماره موبایل", byName: `${req.user!.firstName} ${req.user!.lastName}` } });
  await audit(req.user!.id, "create", "lead", lead.id);
  res.status(201).json({ lead, existed: false });
});

leadsRouter.post("/", async (req, res) => {
  const body = validate(leadSchema, req.body);
  const phone = normalizePhone(body.phone);
  if (!isValidMobile(phone)) throw badRequest("شماره موبایل معتبر نیست");
  const lead = await prisma.lead.create({
    data: { ...body, phone, leadNumber: await nextNumber("lead", "L-"), followUpAt: body.followUpAt ?? null, assignedToId: body.assignedToId ?? req.user!.id },
    include,
  });
  await audit(req.user!.id, "create", "lead", lead.id);
  res.status(201).json({ lead });
});

leadsRouter.get("/:id", async (req, res) => {
  const lead = await prisma.lead.findUnique({ where: { id: String(req.params.id) }, include: { ...include, activities: { orderBy: { createdAt: "desc" } } } });
  if (!lead) throw notFound("لید یافت نشد");
  const sms = await prisma.smsLog.findMany({ where: { relatedType: "lead", relatedId: lead.id }, orderBy: { createdAt: "desc" }, take: 20 });
  res.json({ lead, sms });
});

leadsRouter.patch("/:id", async (req, res) => {
  const body = validate(leadSchema.partial(), req.body);
  const before = await prisma.lead.findUnique({ where: { id: String(req.params.id) } });
  if (!before) throw notFound("لید یافت نشد");
  const data: any = { ...body };
  if (body.phone) data.phone = normalizePhone(body.phone);
  if ("followUpAt" in body) data.followUpAt = body.followUpAt ?? null;
  const lead = await prisma.lead.update({ where: { id: String(req.params.id) }, data, include });
  if (body.status && body.status !== before.status) {
    await prisma.leadActivity.create({ data: { leadId: lead.id, type: "STATUS", content: `تغییر وضعیت به ${body.status}`, byName: `${req.user!.firstName} ${req.user!.lastName}` } });
  }
  res.json({ lead });
});

leadsRouter.post("/:id/activities", async (req, res) => {
  const body = validate(z.object({ type: z.enum(["NOTE", "CALL", "SMS", "STATUS"]).optional(), content: z.string().min(1) }), req.body);
  const a = await prisma.leadActivity.create({ data: { leadId: String(req.params.id), type: body.type ?? "NOTE", content: body.content, byName: `${req.user!.firstName} ${req.user!.lastName}` } });
  res.status(201).json({ activity: a });
});

/** ارسال پیامک پیگیری به لید */
leadsRouter.post("/:id/sms", async (req, res) => {
  const lead = await prisma.lead.findUnique({ where: { id: String(req.params.id) } });
  if (!lead) throw notFound("لید یافت نشد");
  const body = validate(z.object({ message: z.string().optional(), templateKey: z.string().optional() }), req.body);
  const log = body.message
    ? await sendRawSms(lead.phone, body.message, { related: { type: "lead", id: lead.id } })
    : await sendTemplateSms(body.templateKey ?? "lead_followup", lead.phone, { name: `${lead.firstName} ${lead.lastName}`.trim(), phone: await getSetting("clinic.phone") }, { related: { type: "lead", id: lead.id } });
  await prisma.leadActivity.create({ data: { leadId: lead.id, type: "SMS", content: `ارسال پیامک (${log.status})`, byName: `${req.user!.firstName} ${req.user!.lastName}` } });
  res.json({ log });
});

leadsRouter.delete("/:id", async (req, res) => {
  await prisma.lead.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

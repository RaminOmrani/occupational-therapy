import { Router } from "express";
import { z } from "zod";
import { normalizePhone, isValidMobile, isPhoneLike, daysUntilBirthday, GENDERS, PATIENT_STATUSES } from "@toranj/shared";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zOptionalDate, zOptionalString } from "../lib/validate.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { nextNumber } from "../lib/numbering.js";
import { hashPassword } from "../lib/auth.js";
import { requireAuth, requireStaff, requireRole, canAccessPatient } from "../middleware/auth.js";
import { sendTemplateSms } from "../lib/sms/service.js";
import { getSetting, getSettingBool, getSettingNumber } from "../lib/settings.js";
import { patientFinancialSummary } from "../lib/finance.js";
import { audit } from "../lib/audit.js";

export const patientsRouter = Router();

const patientSchema = z.object({
  firstName: z.string().min(1, "نام الزامی است"),
  lastName: z.string().min(1, "نام خانوادگی الزامی است"),
  phone: z.string().min(10, "شماره تماس الزامی است"),
  birthDate: zOptionalDate.optional(),
  gender: z.enum(GENDERS).nullable().optional(),
  nationalId: zOptionalString,
  guardianName: zOptionalString,
  guardianPhone: zOptionalString,
  address: zOptionalString,
  referralSource: zOptionalString,
  diagnosis: zOptionalString,
  notes: zOptionalString,
  status: z.enum(PATIENT_STATUSES).optional(),
  primaryTherapistId: zOptionalString,
  tags: z.array(z.string()).optional(),
  createAccount: z.boolean().optional(),
  leadId: zOptionalString,
});

/** ایجاد حساب کاربری بیمار (ورود با OTP) و ارسال پیامک خوش‌آمد */
export async function ensurePatientAccount(patientId: string) {
  const p = await prisma.patient.findUnique({ where: { id: patientId }, include: { user: true } });
  if (!p) throw notFound("بیمار یافت نشد");
  if (p.user) return p.user;
  const phone = normalizePhone(p.phone);
  if (!isValidMobile(phone)) throw badRequest("برای ساخت حساب، شماره موبایل معتبر لازم است");
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    if (existing.role !== "PATIENT") throw badRequest("این شماره متعلق به یکی از کارکنان است");
    const linked = await prisma.patient.findUnique({ where: { userId: existing.id } });
    if (linked && linked.id !== patientId) throw badRequest("این شماره قبلاً به پرونده دیگری متصل شده است");
    await prisma.patient.update({ where: { id: patientId }, data: { userId: existing.id } });
    return existing;
  }
  const user = await prisma.user.create({
    data: { phone, role: "PATIENT", firstName: p.firstName, lastName: p.lastName, passwordHash: await hashPassword(p.fileNumber) },
  });
  await prisma.patient.update({ where: { id: patientId }, data: { userId: user.id } });
  return user;
}

const patientInclude = {
  primaryTherapist: { include: { user: { select: { firstName: true, lastName: true } } } },
  user: { select: { id: true, phone: true, lastLoginAt: true } },
} as const;

function shape(p: any) {
  return {
    ...p,
    tags: parseJson<string[]>(p.tags, []),
    fullName: `${p.firstName} ${p.lastName}`,
    primaryTherapistName: p.primaryTherapist ? `${p.primaryTherapist.user.firstName} ${p.primaryTherapist.user.lastName}` : null,
    hasAccount: !!p.user,
    daysToBirthday: daysUntilBirthday(p.birthDate),
  };
}

patientsRouter.use(requireAuth);

/** جستجو و فهرست بیماران با فیلترهای متنوع */
patientsRouter.get("/", requireStaff, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const status = String(req.query.status ?? "");
  const therapistId = String(req.query.therapistId ?? "");
  const gender = String(req.query.gender ?? "");
  const birthdayWithin = Number(req.query.birthdayWithin ?? 0);
  const debt = String(req.query.debt ?? ""); // debtor | settled | credit
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 20)));
  const sort = String(req.query.sort ?? "createdAt:desc");
  const [sortField, sortDir] = sort.split(":");

  const where: any = {};
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { fileNumber: { contains: q } },
      { nationalId: { contains: q } },
      { guardianName: { contains: q } },
    ];
    if (isPhoneLike(q)) where.OR.push({ phone: { contains: normalizePhone(q) } });
    // جستجوی «نام نام‌خانوادگی» با هم
    const parts = q.split(/\s+/);
    if (parts.length >= 2) where.OR.push({ AND: [{ firstName: { contains: parts[0] } }, { lastName: { contains: parts.slice(1).join(" ") } }] });
  }
  if (status) where.status = status;
  if (therapistId) where.primaryTherapistId = therapistId;
  if (gender) where.gender = gender;
  if (req.user!.role === "THERAPIST" && req.query.mine === "1") where.primaryTherapistId = req.user!.therapistId;

  let rows = await prisma.patient.findMany({ where, include: patientInclude, orderBy: { [sortField || "createdAt"]: sortDir === "asc" ? "asc" : "desc" } });
  let items = rows.map(shape);
  if (birthdayWithin > 0) items = items.filter((p) => p.daysToBirthday !== null && p.daysToBirthday <= birthdayWithin);
  if (debt) {
    const withFin = await Promise.all(items.map(async (p) => ({ ...p, finance: await patientFinancialSummary(p.id) })));
    items = withFin.filter((p) => (debt === "debtor" ? p.finance.balance > 0 : debt === "credit" ? p.finance.balance < 0 : p.finance.balance <= 0));
  }
  const total = items.length;
  const paged = items.slice((page - 1) * pageSize, page * pageSize);
  res.json({ items: paged, total, page, pageSize });
});

/** لیست کوتاه برای انتخاب در فرم‌ها */
patientsRouter.get("/lookup", requireStaff, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const where: any = { status: { not: "ARCHIVED" } };
  if (q) {
    where.OR = [{ firstName: { contains: q } }, { lastName: { contains: q } }, { fileNumber: { contains: q } }];
    if (isPhoneLike(q)) where.OR.push({ phone: { contains: normalizePhone(q) } });
  }
  const rows = await prisma.patient.findMany({ where, take: 30, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true, fileNumber: true, phone: true, primaryTherapistId: true } });
  res.json({ items: rows.map((r) => ({ ...r, fullName: `${r.firstName} ${r.lastName}` })) });
});

/** تولدهای نزدیک */
patientsRouter.get("/birthdays", requireStaff, async (req, res) => {
  const days = Number(req.query.days ?? (await getSettingNumber("crm.birthdayDaysAhead", 7)));
  const rows = await prisma.patient.findMany({ where: { birthDate: { not: null }, status: { not: "ARCHIVED" } }, include: patientInclude });
  const items = rows
    .map(shape)
    .filter((p) => p.daysToBirthday !== null && p.daysToBirthday <= days)
    .sort((a, b) => (a.daysToBirthday ?? 0) - (b.daysToBirthday ?? 0));
  res.json({ items, days });
});

patientsRouter.post("/", requireStaff, async (req, res) => {
  const body = validate(patientSchema, req.body);
  const phone = normalizePhone(body.phone);
  if (!isValidMobile(phone)) throw badRequest("شماره موبایل معتبر نیست (مثال: 09123456789)");
  const fileNumber = await nextNumber("patient", "OT-");
  const { createAccount, tags, leadId, ...rest } = body;
  const patient = await prisma.patient.create({
    data: { ...rest, phone, fileNumber, tags: JSON.stringify(tags ?? []), leadId: leadId ?? null, birthDate: body.birthDate ?? null },
    include: patientInclude,
  });
  if (leadId) {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "CONVERTED" } }).catch(() => null);
    await prisma.leadActivity.create({ data: { leadId, type: "STATUS", content: `تبدیل به بیمار با شماره پرونده ${fileNumber}`, byName: `${req.user!.firstName} ${req.user!.lastName}` } }).catch(() => null);
  }
  if (createAccount !== false) {
    try {
      await ensurePatientAccount(patient.id);
    } catch (e) {
      console.warn("patient account not created:", (e as Error).message);
    }
  }
  if (await getSettingBool("sms.autoWelcome", true)) {
    sendTemplateSms("welcome", phone, { name: `${patient.firstName} ${patient.lastName}`, fileNumber }, { related: { type: "patient", id: patient.id } }).catch(console.error);
  }
  await audit(req.user!.id, "create", "patient", patient.id, { fileNumber });
  const fresh = await prisma.patient.findUnique({ where: { id: patient.id }, include: patientInclude });
  res.status(201).json({ patient: shape(fresh) });
});

patientsRouter.get("/:id", async (req, res) => {
  if (!canAccessPatient(req, String(req.params.id))) throw forbidden();
  const p = await prisma.patient.findUnique({ where: { id: String(req.params.id) }, include: patientInclude });
  if (!p) throw notFound("بیمار یافت نشد");
  const [finance, counts, nextAppointment, lastAppointment] = await Promise.all([
    patientFinancialSummary(p.id),
    Promise.all([
      prisma.appointment.count({ where: { patientId: p.id, status: "DONE" } }),
      prisma.intakeForm.count({ where: { patientId: p.id } }),
      prisma.assessment.count({ where: { patientId: p.id } }),
      prisma.progressNote.count({ where: { patientId: p.id } }),
    ]),
    prisma.appointment.findFirst({ where: { patientId: p.id, startAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } }, orderBy: { startAt: "asc" }, include: { therapist: { include: { user: { select: { firstName: true, lastName: true } } } } } }),
    prisma.appointment.findFirst({ where: { patientId: p.id, status: "DONE" }, orderBy: { startAt: "desc" } }),
  ]);
  res.json({
    patient: shape(p),
    finance,
    stats: { sessionsDone: counts[0], intakeForms: counts[1], assessments: counts[2], progressNotes: counts[3] },
    nextAppointment,
    lastAppointment,
  });
});

patientsRouter.patch("/:id", requireStaff, async (req, res) => {
  const body = validate(patientSchema.partial(), req.body);
  const data: any = { ...body };
  delete data.createAccount;
  delete data.leadId;
  if (body.phone) {
    data.phone = normalizePhone(body.phone);
    if (!isValidMobile(data.phone)) throw badRequest("شماره موبایل معتبر نیست");
  }
  if (body.tags) data.tags = JSON.stringify(body.tags);
  if ("birthDate" in body) data.birthDate = body.birthDate ?? null;
  const p = await prisma.patient.update({ where: { id: String(req.params.id) }, data, include: patientInclude });
  if (p.userId && (body.firstName || body.lastName)) {
    await prisma.user.update({ where: { id: p.userId }, data: { firstName: p.firstName, lastName: p.lastName } });
  }
  await audit(req.user!.id, "update", "patient", p.id, body);
  res.json({ patient: shape(p) });
});

patientsRouter.post("/:id/account", requireStaff, async (req, res) => {
  const user = await ensurePatientAccount(String(req.params.id));
  res.json({ ok: true, userId: user.id });
});

/** بازنشانی رمز عبور بیمار به شماره پرونده */
patientsRouter.post("/:id/reset-password", requireStaff, async (req, res) => {
  const p = await prisma.patient.findUnique({ where: { id: String(req.params.id) } });
  if (!p || !p.userId) throw notFound("حساب کاربری برای این بیمار وجود ندارد");
  await prisma.user.update({ where: { id: p.userId }, data: { passwordHash: await hashPassword(p.fileNumber) } });
  res.json({ ok: true, message: `رمز عبور به شماره پرونده (${p.fileNumber}) بازنشانی شد` });
});

patientsRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.patient.update({ where: { id: String(req.params.id) }, data: { status: "ARCHIVED" } });
  await audit(req.user!.id, "archive", "patient", String(req.params.id));
  res.json({ ok: true });
});

/** خلاصه کامل پرونده بالینی (برای صفحه بیمار) */
patientsRouter.get("/:id/timeline", async (req, res) => {
  if (!canAccessPatient(req, String(req.params.id))) throw forbidden();
  const id = String(req.params.id);
  const isPatient = req.user!.role === "PATIENT";
  const vis = isPatient ? { visibleToPatient: true } : {};
  const therapistSel = { include: { user: { select: { firstName: true, lastName: true } } } };
  const [intakes, assessments, progress, appointments, goals, homePrograms] = await Promise.all([
    prisma.intakeForm.findMany({ where: { patientId: id, ...vis }, orderBy: { date: "desc" }, include: { therapist: therapistSel } }),
    prisma.assessment.findMany({ where: { patientId: id, ...vis }, orderBy: { date: "desc" }, include: { therapist: therapistSel } }),
    prisma.progressNote.findMany({ where: { patientId: id, ...vis }, orderBy: { date: "desc" }, include: { therapist: therapistSel } }),
    prisma.appointment.findMany({ where: { patientId: id }, orderBy: { startAt: "desc" }, take: 50, include: { therapist: therapistSel } }),
    prisma.treatmentGoal.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" } }),
    prisma.homeProgram.findMany({ where: { patientId: id, isActive: true }, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({
    intakes,
    assessments: assessments.map((a) => ({ ...a, items: parseJson(a.items, []) })),
    progress,
    appointments,
    goals,
    homePrograms: homePrograms.map((h) => ({ ...h, completions: parseJson<string[]>(h.completions, []) })),
  });
});


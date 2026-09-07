import { Router } from "express";
import { z } from "zod";
import { ASSESSMENT_TYPES, assessmentScore, GOAL_STATUSES, startOfDay, endOfDay, type AssessmentType } from "@toranj/shared";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zDate, zOptionalString, zOptionalInt, zOptionalDate } from "../lib/validate.js";
import { forbidden, notFound, badRequest } from "../lib/errors.js";
import { requireAuth, requireStaff, requireRole, canAccessPatient } from "../middleware/auth.js";
import { notifyUser } from "../lib/notify.js";
import { audit } from "../lib/audit.js";
import { maybeSendSurvey } from "../lib/survey.js";

export const formsRouter = Router();
formsRouter.use(requireAuth);

const therapistInclude = { therapist: { select: { id: true, user: { select: { firstName: true, lastName: true } } } }, patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true, userId: true } } } as const;

function shapeForm(f: any) {
  return {
    ...f,
    therapistName: f.therapist ? `${f.therapist.user.firstName} ${f.therapist.user.lastName}` : null,
    patientName: f.patient ? `${f.patient.firstName} ${f.patient.lastName}` : null,
    items: f.items !== undefined ? parseJson(f.items, []) : undefined,
  };
}

/** درمانگر جاری؛ مدیر/منشی می‌توانند therapistId را صریح بدهند */
function resolveTherapistId(req: any, given?: string | null): string {
  if (req.user.role === "THERAPIST") return req.user.therapistId;
  if (!given) throw badRequest("درمانگر را انتخاب کنید");
  return given;
}

/** فیلترهای مشترک: بیمار، درمانگر، بازه تاریخ، جستجوی نام */
async function commonWhere(req: any) {
  const where: any = {};
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  if (req.query.therapistId) where.therapistId = String(req.query.therapistId);
  if (req.user.role === "PATIENT") {
    where.patientId = req.user.patientId;
    where.visibleToPatient = true;
  }
  if (req.user.role === "THERAPIST" && req.query.all !== "1") where.therapistId = req.user.therapistId;
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = startOfDay(new Date(String(req.query.from)));
    if (req.query.to) where.date.lte = endOfDay(new Date(String(req.query.to)));
  }
  const q = String(req.query.q ?? "").trim();
  if (q) where.patient = { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { fileNumber: { contains: q } }] };
  return where;
}

function canEdit(req: any, form: { therapistId: string }) {
  if (req.user.role === "ADMIN") return true;
  if (req.user.role === "THERAPIST") return form.therapistId === req.user.therapistId;
  return false;
}

// ---------------- شرح حال اولیه ----------------
const intakeSchema = z.object({
  patientId: z.string().min(1),
  therapistId: zOptionalString,
  date: zDate.optional(),
  chiefComplaint: z.string().min(1, "شکایت اصلی الزامی است"),
  historyPresent: zOptionalString,
  medicalHistory: zOptionalString,
  medications: zOptionalString,
  familyHistory: zOptionalString,
  developmental: zOptionalString,
  socialHistory: zOptionalString,
  precautions: zOptionalString,
  previousTherapy: zOptionalString,
  expectations: zOptionalString,
  diagnosis: zOptionalString,
  plan: zOptionalString,
  visibleToPatient: z.boolean().optional(),
});

formsRouter.get("/intake", async (req, res) => {
  const where = await commonWhere(req);
  const items = await prisma.intakeForm.findMany({ where, include: therapistInclude, orderBy: { date: "desc" }, take: 200 });
  res.json({ items: items.map(shapeForm) });
});
formsRouter.post("/intake", requireStaff, async (req, res) => {
  const body = validate(intakeSchema, req.body);
  const therapistId = resolveTherapistId(req, body.therapistId);
  const f = await prisma.intakeForm.create({ data: { ...body, therapistId, date: body.date ?? new Date() }, include: therapistInclude });
  await audit(req.user!.id, "create", "intake", f.id);
  res.status(201).json({ form: shapeForm(f) });
});
formsRouter.get("/intake/:id", async (req, res) => {
  const f = await prisma.intakeForm.findUnique({ where: { id: String(req.params.id) }, include: therapistInclude });
  if (!f || !canAccessPatient(req, f.patientId)) throw notFound("فرم یافت نشد");
  if (req.user!.role === "PATIENT" && !f.visibleToPatient) throw forbidden();
  res.json({ form: shapeForm(f) });
});
formsRouter.patch("/intake/:id", requireStaff, async (req, res) => {
  const cur = await prisma.intakeForm.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound("فرم یافت نشد");
  if (!canEdit(req, cur)) throw forbidden();
  const body = validate(intakeSchema.partial(), req.body);
  const { therapistId, ...rest } = body;
  const f = await prisma.intakeForm.update({ where: { id: cur.id }, data: rest, include: therapistInclude });
  res.json({ form: shapeForm(f) });
});
formsRouter.delete("/intake/:id", requireRole("ADMIN", "THERAPIST"), async (req, res) => {
  const cur = await prisma.intakeForm.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound();
  if (!canEdit(req, cur)) throw forbidden();
  await prisma.intakeForm.delete({ where: { id: cur.id } });
  res.json({ ok: true });
});

// ---------------- ارزیابی‌ها (۳ فرم) ----------------
const assessmentSchema = z.object({
  patientId: z.string().min(1),
  therapistId: zOptionalString,
  type: z.enum(ASSESSMENT_TYPES),
  date: zDate.optional(),
  items: z.array(z.object({ key: z.string(), score: z.number().int().min(0).max(4).nullable(), note: z.string().optional() })),
  summary: zOptionalString,
  recommendations: zOptionalString,
  visibleToPatient: z.boolean().optional(),
});

formsRouter.get("/assessments", async (req, res) => {
  const where = await commonWhere(req);
  if (req.query.type) where.type = String(req.query.type);
  const items = await prisma.assessment.findMany({ where, include: therapistInclude, orderBy: { date: "desc" }, take: 300 });
  res.json({ items: items.map(shapeForm) });
});
formsRouter.post("/assessments", requireStaff, async (req, res) => {
  const body = validate(assessmentSchema, req.body);
  const therapistId = resolveTherapistId(req, body.therapistId);
  const { score, max } = assessmentScore(body.type as AssessmentType, body.items);
  const f = await prisma.assessment.create({
    data: { patientId: body.patientId, therapistId, type: body.type, date: body.date ?? new Date(), items: JSON.stringify(body.items), score, maxScore: max, summary: body.summary ?? null, recommendations: body.recommendations ?? null, visibleToPatient: body.visibleToPatient ?? true },
    include: therapistInclude,
  });
  if (f.patient.userId && f.visibleToPatient) await notifyUser(f.patient.userId, "ارزیابی جدید ثبت شد", "نتیجه ارزیابی جدید در پرونده شما قابل مشاهده است", "/panel/my/records");
  await audit(req.user!.id, "create", "assessment", f.id, { type: body.type });
  res.status(201).json({ form: shapeForm(f) });
});
formsRouter.get("/assessments/:id", async (req, res) => {
  const f = await prisma.assessment.findUnique({ where: { id: String(req.params.id) }, include: therapistInclude });
  if (!f || !canAccessPatient(req, f.patientId)) throw notFound("ارزیابی یافت نشد");
  if (req.user!.role === "PATIENT" && !f.visibleToPatient) throw forbidden();
  res.json({ form: shapeForm(f) });
});
formsRouter.patch("/assessments/:id", requireStaff, async (req, res) => {
  const cur = await prisma.assessment.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound("ارزیابی یافت نشد");
  if (!canEdit(req, cur)) throw forbidden();
  const body = validate(assessmentSchema.partial(), req.body);
  const data: any = { summary: body.summary, recommendations: body.recommendations, visibleToPatient: body.visibleToPatient, date: body.date };
  if (body.items) {
    const { score, max } = assessmentScore(cur.type as AssessmentType, body.items);
    data.items = JSON.stringify(body.items);
    data.score = score;
    data.maxScore = max;
  }
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const f = await prisma.assessment.update({ where: { id: cur.id }, data, include: therapistInclude });
  res.json({ form: shapeForm(f) });
});
formsRouter.delete("/assessments/:id", requireRole("ADMIN", "THERAPIST"), async (req, res) => {
  const cur = await prisma.assessment.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound();
  if (!canEdit(req, cur)) throw forbidden();
  await prisma.assessment.delete({ where: { id: cur.id } });
  res.json({ ok: true });
});

/** روند امتیاز ارزیابی‌های یک بیمار برای نمودار پیشرفت */
formsRouter.get("/assessments/trend/:patientId", async (req, res) => {
  if (!canAccessPatient(req, String(req.params.patientId))) throw forbidden();
  const rows = await prisma.assessment.findMany({ where: { patientId: String(req.params.patientId), ...(req.user!.role === "PATIENT" ? { visibleToPatient: true } : {}) }, orderBy: { date: "asc" }, select: { id: true, type: true, date: true, score: true, maxScore: true } });
  res.json({ items: rows.map((r) => ({ ...r, percent: r.maxScore ? Math.round((r.score / r.maxScore) * 100) : 0 })) });
});

// ---------------- گزارش پیشرفت (SOAP) ----------------
const progressSchema = z.object({
  patientId: z.string().min(1),
  therapistId: zOptionalString,
  appointmentId: zOptionalString,
  date: zDate.optional(),
  sessionNumber: zOptionalInt,
  subjective: zOptionalString,
  objective: zOptionalString,
  assessment: zOptionalString,
  plan: zOptionalString,
  activities: zOptionalString,
  progressScore: zOptionalInt,
  cooperation: zOptionalInt,
  homework: zOptionalString,
  visibleToPatient: z.boolean().optional(),
});

formsRouter.get("/progress", async (req, res) => {
  const where = await commonWhere(req);
  const items = await prisma.progressNote.findMany({ where, include: therapistInclude, orderBy: { date: "desc" }, take: 300 });
  res.json({ items: items.map(shapeForm) });
});
formsRouter.post("/progress", requireStaff, async (req, res) => {
  const body = validate(progressSchema, req.body);
  const therapistId = resolveTherapistId(req, body.therapistId);
  const count = await prisma.progressNote.count({ where: { patientId: body.patientId } });
  const f = await prisma.progressNote.create({
    data: { ...body, therapistId, date: body.date ?? new Date(), sessionNumber: body.sessionNumber ?? count + 1, appointmentId: body.appointmentId ?? null },
    include: therapistInclude,
  });
  if (body.appointmentId) {
    const prev = await prisma.appointment.findUnique({ where: { id: body.appointmentId }, select: { status: true } });
    await prisma.appointment.update({ where: { id: body.appointmentId }, data: { status: "DONE" } }).catch(() => null);
    if (prev && prev.status !== "DONE") maybeSendSurvey(body.patientId);
  }
  if (f.patient.userId && f.visibleToPatient) await notifyUser(f.patient.userId, "گزارش جلسه ثبت شد", "گزارش پیشرفت جلسه اخیر شما در پرونده ثبت شد", "/panel/my/records");
  await audit(req.user!.id, "create", "progress", f.id);
  res.status(201).json({ form: shapeForm(f) });
});
formsRouter.get("/progress/:id", async (req, res) => {
  const f = await prisma.progressNote.findUnique({ where: { id: String(req.params.id) }, include: therapistInclude });
  if (!f || !canAccessPatient(req, f.patientId)) throw notFound("گزارش یافت نشد");
  if (req.user!.role === "PATIENT" && !f.visibleToPatient) throw forbidden();
  res.json({ form: shapeForm(f) });
});
formsRouter.patch("/progress/:id", requireStaff, async (req, res) => {
  const cur = await prisma.progressNote.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound("گزارش یافت نشد");
  if (!canEdit(req, cur)) throw forbidden();
  const body = validate(progressSchema.partial(), req.body);
  const { therapistId, ...rest } = body;
  const f = await prisma.progressNote.update({ where: { id: cur.id }, data: rest, include: therapistInclude });
  res.json({ form: shapeForm(f) });
});
formsRouter.delete("/progress/:id", requireRole("ADMIN", "THERAPIST"), async (req, res) => {
  const cur = await prisma.progressNote.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound();
  if (!canEdit(req, cur)) throw forbidden();
  await prisma.progressNote.delete({ where: { id: cur.id } });
  res.json({ ok: true });
});

// ---------------- عملکرد روزانه درمانگر ----------------
const dailySchema = z.object({
  date: zDate,
  patientId: zOptionalString,
  sessionsDone: zOptionalInt,
  activities: z.string().min(1, "شرح فعالیت‌ها الزامی است"),
  achievements: zOptionalString,
  challenges: zOptionalString,
  mood: zOptionalInt,
  notes: zOptionalString,
  therapistUserId: zOptionalString,
});

formsRouter.get("/daily", requireStaff, async (req, res) => {
  const where: any = {};
  if (req.user!.role === "THERAPIST") where.therapistUserId = req.user!.id;
  else if (req.query.therapistUserId) where.therapistUserId = String(req.query.therapistUserId);
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = startOfDay(new Date(String(req.query.from)));
    if (req.query.to) where.date.lte = endOfDay(new Date(String(req.query.to)));
  }
  const items = await prisma.dailyPerformance.findMany({ where, include: { therapist: { select: { id: true, firstName: true, lastName: true } }, patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true } } }, orderBy: { date: "desc" }, take: 300 });
  res.json({ items: items.map((i) => ({ ...i, therapistName: `${i.therapist.firstName} ${i.therapist.lastName}`, patientName: i.patient ? `${i.patient.firstName} ${i.patient.lastName}` : null })) });
});
formsRouter.post("/daily", requireStaff, async (req, res) => {
  const body = validate(dailySchema, req.body);
  const therapistUserId = req.user!.role === "THERAPIST" ? req.user!.id : body.therapistUserId;
  if (!therapistUserId) throw badRequest("درمانگر را انتخاب کنید");
  const f = await prisma.dailyPerformance.create({ data: { ...body, therapistUserId, patientId: body.patientId ?? null, sessionsDone: body.sessionsDone ?? 0 } });
  res.status(201).json({ form: f });
});
formsRouter.patch("/daily/:id", requireStaff, async (req, res) => {
  const cur = await prisma.dailyPerformance.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound();
  if (req.user!.role === "THERAPIST" && cur.therapistUserId !== req.user!.id) throw forbidden();
  const body = validate(dailySchema.partial(), req.body);
  const { therapistUserId, ...rest } = body;
  const f = await prisma.dailyPerformance.update({ where: { id: cur.id }, data: { ...rest, sessionsDone: rest.sessionsDone ?? undefined, patientId: rest.patientId === undefined ? undefined : rest.patientId } });
  res.json({ form: f });
});
formsRouter.delete("/daily/:id", requireStaff, async (req, res) => {
  const cur = await prisma.dailyPerformance.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound();
  if (req.user!.role === "THERAPIST" && cur.therapistUserId !== req.user!.id) throw forbidden();
  await prisma.dailyPerformance.delete({ where: { id: cur.id } });
  res.json({ ok: true });
});

// ---------------- اهداف درمانی ----------------
const goalSchema = z.object({
  patientId: z.string().min(1),
  therapistId: zOptionalString,
  title: z.string().min(1, "عنوان هدف الزامی است"),
  description: zOptionalString,
  category: zOptionalString,
  targetDate: zOptionalDate.optional(),
  progress: zOptionalInt,
  status: z.enum(GOAL_STATUSES).optional(),
});
formsRouter.get("/goals", async (req, res) => {
  const where: any = {};
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  if (req.user!.role === "PATIENT") where.patientId = req.user!.patientId;
  const items = await prisma.treatmentGoal.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  res.json({ items });
});
formsRouter.post("/goals", requireStaff, async (req, res) => {
  const body = validate(goalSchema, req.body);
  const therapistId = resolveTherapistId(req, body.therapistId);
  const g = await prisma.treatmentGoal.create({ data: { ...body, therapistId, targetDate: body.targetDate ?? null, progress: body.progress ?? 0 } });
  res.status(201).json({ goal: g });
});
formsRouter.patch("/goals/:id", requireStaff, async (req, res) => {
  const body = validate(goalSchema.partial(), req.body);
  const { therapistId, patientId, ...rest } = body;
  const data: any = { ...rest };
  if ("targetDate" in body) data.targetDate = body.targetDate ?? null;
  const g = await prisma.treatmentGoal.update({ where: { id: String(req.params.id) }, data });
  res.json({ goal: g });
});
formsRouter.delete("/goals/:id", requireStaff, async (req, res) => {
  await prisma.treatmentGoal.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

// ---------------- برنامه تمرین خانگی ----------------
const homeSchema = z.object({
  patientId: z.string().min(1),
  therapistId: zOptionalString,
  title: z.string().min(1),
  description: z.string().min(1),
  frequency: zOptionalString,
  videoUrl: zOptionalString,
  isActive: z.boolean().optional(),
});
formsRouter.get("/home-programs", async (req, res) => {
  const where: any = {};
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  if (req.user!.role === "PATIENT") where.patientId = req.user!.patientId;
  const items = await prisma.homeProgram.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json({ items: items.map((h) => ({ ...h, completions: parseJson<string[]>(h.completions, []) })) });
});
formsRouter.post("/home-programs", requireStaff, async (req, res) => {
  const body = validate(homeSchema, req.body);
  const therapistId = resolveTherapistId(req, body.therapistId);
  const h = await prisma.homeProgram.create({ data: { ...body, therapistId }, include: { patient: { select: { userId: true } } } });
  await notifyUser(h.patient.userId, "تمرین خانگی جدید", h.title, "/panel/my/home");
  res.status(201).json({ program: { ...h, completions: [] } });
});
formsRouter.patch("/home-programs/:id", requireStaff, async (req, res) => {
  const body = validate(homeSchema.partial(), req.body);
  const { therapistId, patientId, ...rest } = body;
  const h = await prisma.homeProgram.update({ where: { id: String(req.params.id) }, data: rest });
  res.json({ program: { ...h, completions: parseJson<string[]>(h.completions, []) } });
});
/** بیمار انجام تمرین امروز را ثبت می‌کند */
formsRouter.post("/home-programs/:id/complete", async (req, res) => {
  const h = await prisma.homeProgram.findUnique({ where: { id: String(req.params.id) } });
  if (!h || !canAccessPatient(req, h.patientId)) throw notFound();
  const day = String(req.body?.date ?? new Date().toISOString().slice(0, 10));
  const set = new Set(parseJson<string[]>(h.completions, []));
  if (set.has(day)) set.delete(day);
  else set.add(day);
  const updated = await prisma.homeProgram.update({ where: { id: h.id }, data: { completions: JSON.stringify([...set].sort()) } });
  res.json({ program: { ...updated, completions: [...set].sort() } });
});
formsRouter.delete("/home-programs/:id", requireStaff, async (req, res) => {
  await prisma.homeProgram.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

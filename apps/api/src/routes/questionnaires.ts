import { Router, type Request } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { QUESTIONNAIRES, QUESTIONNAIRE_TYPES, isValidMobile, normalizePhone, scoreQuestionnaire, validateAnswers, type QuestionnaireType } from "@toranj/shared";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zOptionalString } from "../lib/validate.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { requireAuth, requireStaff, requireAdminOrSecretary, requireRole } from "../middleware/auth.js";
import { nextNumber } from "../lib/numbering.js";
import { audit } from "../lib/audit.js";
import { assignQuestionnaire, notifyAnalysisShared, notifySubmitted, DEFAULT_QUESTIONNAIRE } from "../lib/questionnaires.js";

export const questionnairesRouter = Router();

const defOf = (type: string) => {
  const d = QUESTIONNAIRES[type as QuestionnaireType];
  if (!d) throw notFound("پرسشنامه یافت نشد");
  return d;
};

async function isAnalyst(req: Request) {
  if (!req.user) return false;
  if (req.user.role === "ADMIN") return true;
  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { testAnalyst: true } });
  return !!u?.testAnalyst;
}

const patientSel = { select: { id: true, firstName: true, lastName: true, fileNumber: true, phone: true, birthDate: true, primaryTherapistId: true, primaryTherapist: { select: { user: { select: { firstName: true, lastName: true } } } } } } as const;

function shape(r: any, withAnswers = false) {
  const def = QUESTIONNAIRES[r.type as QuestionnaireType];
  const answers = parseJson<Record<string, number>>(r.answers ?? "null", {}) ?? {};
  return {
    id: r.id,
    type: r.type,
    title: def?.title ?? r.type,
    status: r.status,
    source: r.source,
    patientId: r.patientId,
    patient: r.patient ? { id: r.patient.id, fullName: `${r.patient.firstName} ${r.patient.lastName}`, fileNumber: r.patient.fileNumber, phone: r.patient.phone, therapistName: r.patient.primaryTherapist ? `${r.patient.primaryTherapist.user.firstName} ${r.patient.primaryTherapist.user.lastName}` : null } : null,
    respondentName: r.respondentName,
    respondentPhone: r.respondentPhone,
    subjectName: r.subjectName,
    subjectAge: r.subjectAge,
    leadId: r.leadId,
    analysis: r.analysis,
    shareWithPatient: r.shareWithPatient,
    createdAt: r.createdAt,
    approvedAt: r.approvedAt,
    submittedAt: r.submittedAt,
    analyzedAt: r.analyzedAt,
    scores: def && r.answers ? scoreQuestionnaire(def, answers) : null,
    ...(withAnswers ? { answers } : {}),
  };
}

/* ───────── تکمیل پرسشنامه (سایت عمومی و پنل مراجع) ───────── */
const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { message: "تعداد ارسال‌ها زیاد است؛ کمی بعد دوباره امتحان کنید" } });

const submitSchema = z.object({
  answers: z.record(z.string(), z.number().int().min(0).max(5).nullable()),
  respondentName: zOptionalString,
  respondentPhone: zOptionalString,
  subjectName: zOptionalString,
  subjectAge: zOptionalString,
  responseId: zOptionalString,
});

/**
 * مراجع عضو (وارد شده): پاسخ در پرونده خودش ثبت می‌شود (اگر پرسشنامه ارسال‌شده‌ای داشته باشد همان تکمیل می‌شود).
 * مهمان سایت: نام، شماره و نام کودک لازم است؛ به‌عنوان لید در CRM ثبت می‌شود تا کلینیک پیگیری کند.
 */
questionnairesRouter.post("/submit/:type", submitLimiter, async (req, res) => {
  const def = defOf(String(req.params.type));
  const body = validate(submitSchema, req.body);
  const v = validateAnswers(def, body.answers);
  if (!v.ok) throw badRequest(`به همه سؤال‌ها پاسخ دهید (${v.missing.length} سؤال بی‌پاسخ، مثلاً سؤال ${v.missing.slice(0, 5).join("، ")})`);
  const scores = JSON.stringify(scoreQuestionnaire(def, v.clean));
  const answers = JSON.stringify(v.clean);
  const extra = { respondentName: body.respondentName ?? null, subjectName: body.subjectName ?? null, subjectAge: body.subjectAge ?? null };

  if (req.user?.role === "PATIENT" && req.user.patientId) {
    const patientId = req.user.patientId;
    const target = body.responseId
      ? await prisma.questionnaireResponse.findFirst({ where: { id: body.responseId, patientId, status: "ASSIGNED" } })
      : await prisma.questionnaireResponse.findFirst({ where: { patientId, type: def.type, status: { in: ["ASSIGNED", "PENDING_APPROVAL"] } }, orderBy: { createdAt: "desc" } });
    const data = { ...extra, respondentPhone: req.user.phone, answers, scores, status: "SUBMITTED", submittedAt: new Date() };
    const r = target
      ? await prisma.questionnaireResponse.update({ where: { id: target.id }, data })
      : await prisma.questionnaireResponse.create({ data: { ...data, type: def.type, source: "SELF", patientId } });
    await notifySubmitted(r.id);
    await audit(req.user.id, "submit", "questionnaire", r.id);
    return res.status(201).json({ ok: true, id: r.id, member: true });
  }

  // مهمان (یا کارمندی که از سایت عمومی تکمیل می‌کند)
  if (!body.respondentName || body.respondentName.length < 2) throw badRequest("نام و نام خانوادگی تکمیل‌کننده را بنویسید");
  if (!body.subjectName) throw badRequest("نام کودک را بنویسید");
  const phone = normalizePhone(body.respondentPhone ?? "");
  if (!isValidMobile(phone)) throw badRequest("شماره موبایل معتبر نیست (مثال: 09123456789)");
  let leadId: string | null = null;
  const patient = await prisma.patient.findFirst({ where: { phone }, select: { id: true } });
  if (!patient) {
    const existing = await prisma.lead.findFirst({ where: { phone, status: { in: ["NEW", "CONTACTED", "INTERESTED"] } } });
    const [firstName, ...rest] = body.respondentName.trim().split(/\s+/);
    const lead = existing ?? (await prisma.lead.create({ data: { leadNumber: await nextNumber("lead", "L-"), firstName, lastName: rest.join(" "), phone, source: "WEBSITE", interest: `${def.title} برای ${body.subjectName}` } }));
    leadId = lead.id;
    await prisma.leadActivity.create({ data: { leadId: lead.id, type: "NOTE", content: `${def.title} را از سایت تکمیل کرد (کودک: ${body.subjectName}${body.subjectAge ? `، سن ${body.subjectAge}` : ""})`, byName: "سایت" } });
  }
  // پاسخ مهمان مستقیم به پرونده وصل نمی‌شود؛ اگر شماره با مراجعی یکی باشد، کارکنان در بخش تحلیل آن را متصل می‌کنند
  const r = await prisma.questionnaireResponse.create({ data: { ...extra, type: def.type, source: "PUBLIC", status: "SUBMITTED", respondentPhone: phone, leadId, answers, scores, submittedAt: new Date() } });
  await notifySubmitted(r.id);
  res.status(201).json({ ok: true, id: r.id, member: false });
});

questionnairesRouter.use(requireAuth);

/* ───────── مراجع ───────── */
questionnairesRouter.get("/my", requireRole("PATIENT"), async (req, res) => {
  const rows = await prisma.questionnaireResponse.findMany({ where: { patientId: req.user!.patientId ?? "-", status: { not: "DECLINED" }, NOT: { status: "PENDING_APPROVAL" } }, orderBy: { createdAt: "desc" } });
  res.json({
    items: rows.map((r) => {
      const s = shape(r);
      const shared = r.status === "ANALYZED" && r.shareWithPatient;
      return { ...s, analysis: shared ? r.analysis : null, scores: shared ? s.scores : null };
    }),
  });
});

/* ───────── کارکنان ───────── */
questionnairesRouter.get("/", requireStaff, async (req, res) => {
  const where: any = {};
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  if (req.query.type) where.type = String(req.query.type);
  const analyst = await isAnalyst(req);
  // درمانگر بدون دسترسی تحلیل فقط پرسشنامه مراجعین خودش را می‌بیند
  if (req.user!.role === "THERAPIST" && !analyst) where.patient = { primaryTherapistId: req.user!.therapistId ?? "-" };
  const rows = await prisma.questionnaireResponse.findMany({ where, include: { patient: patientSel }, orderBy: { updatedAt: "desc" }, take: 300 });
  const base: any = req.user!.role === "THERAPIST" && !analyst ? { patient: { primaryTherapistId: req.user!.therapistId ?? "-" } } : {};
  const grouped = await prisma.questionnaireResponse.groupBy({ by: ["status"], where: base, _count: { _all: true } });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  res.json({ items: rows.map((r) => shape(r)), counts, canAnalyze: analyst });
});

questionnairesRouter.get("/:id", requireStaff, async (req, res) => {
  const r = await prisma.questionnaireResponse.findUnique({ where: { id: String(req.params.id) }, include: { patient: patientSel } });
  if (!r) throw notFound("پرسشنامه یافت نشد");
  const analyst = await isAnalyst(req);
  if (req.user!.role === "THERAPIST" && !analyst && r.patient?.primaryTherapistId !== req.user!.therapistId) throw forbidden();
  const ids = [r.approvedById, r.analyzedById, r.requestedById].filter(Boolean) as string[];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
  const nameOf = (id: string | null) => { const u = users.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : null; };
  // برای پاسخ مهمان: مراجعی با همین شماره (برای اتصال به پرونده)
  const match = !r.patientId && r.respondentPhone ? await prisma.patient.findFirst({ where: { phone: r.respondentPhone }, select: { id: true, firstName: true, lastName: true, fileNumber: true } }) : null;
  res.json({ item: { ...shape(r, true), approvedBy: nameOf(r.approvedById), analyzedBy: nameOf(r.analyzedById) }, canAnalyze: analyst, phoneMatch: match ? { id: match.id, fullName: `${match.firstName} ${match.lastName}`, fileNumber: match.fileNumber } : null });
});

/** ارسال مستقیم پرسشنامه برای یک مراجع (از پرونده یا فرم مراجع جدید) */
questionnairesRouter.post("/send", requireStaff, async (req, res) => {
  const body = validate(z.object({ patientId: z.string().min(1), type: z.enum(QUESTIONNAIRE_TYPES).optional() }), req.body);
  const type = body.type ?? DEFAULT_QUESTIONNAIRE;
  const p = await prisma.patient.findUnique({ where: { id: body.patientId }, select: { id: true, primaryTherapistId: true } });
  if (!p) throw notFound("مراجع یافت نشد");
  if (req.user!.role === "THERAPIST" && p.primaryTherapistId !== req.user!.therapistId && !(await isAnalyst(req))) throw forbidden();
  const open = await prisma.questionnaireResponse.findFirst({ where: { patientId: p.id, type, status: { in: ["ASSIGNED", "PENDING_APPROVAL"] } } });
  if (open?.status === "ASSIGNED") throw badRequest("این پرسشنامه قبلاً برای مراجع ارسال شده و منتظر تکمیل است");
  const r = open ?? (await prisma.questionnaireResponse.create({ data: { type, patientId: p.id, source: "STAFF", requestedById: req.user!.id } }));
  const out = await assignQuestionnaire(r.id, req.user!.id);
  await audit(req.user!.id, "send", "questionnaire", r.id);
  res.status(201).json({ item: out });
});

questionnairesRouter.post("/:id/approve", requireAdminOrSecretary, async (req, res) => {
  const r = await prisma.questionnaireResponse.findUnique({ where: { id: String(req.params.id) } });
  if (!r || r.status !== "PENDING_APPROVAL") throw notFound("درخواست یافت نشد یا قبلاً بررسی شده");
  const out = await assignQuestionnaire(r.id, req.user!.id);
  await audit(req.user!.id, "approve", "questionnaire", r.id);
  res.json({ item: out });
});

questionnairesRouter.post("/:id/decline", requireAdminOrSecretary, async (req, res) => {
  const r = await prisma.questionnaireResponse.findUnique({ where: { id: String(req.params.id) } });
  if (!r || r.status !== "PENDING_APPROVAL") throw notFound("درخواست یافت نشد یا قبلاً بررسی شده");
  await prisma.questionnaireResponse.update({ where: { id: r.id }, data: { status: "DECLINED", approvedById: req.user!.id, approvedAt: new Date() } });
  await audit(req.user!.id, "decline", "questionnaire", r.id);
  res.json({ ok: true });
});

/** اتصال پاسخ مهمان سایت به پرونده مراجع */
questionnairesRouter.post("/:id/link", requireStaff, async (req, res) => {
  const body = validate(z.object({ patientId: z.string().min(1) }), req.body);
  const r = await prisma.questionnaireResponse.findUnique({ where: { id: String(req.params.id) } });
  if (!r) throw notFound("پرسشنامه یافت نشد");
  const p = await prisma.patient.findUnique({ where: { id: body.patientId }, select: { id: true } });
  if (!p) throw notFound("مراجع یافت نشد");
  await prisma.questionnaireResponse.update({ where: { id: r.id }, data: { patientId: p.id } });
  await audit(req.user!.id, "link", "questionnaire", r.id, { patientId: p.id });
  res.json({ ok: true });
});

/** تحلیل آزمون: فقط مدیر و کاربرانی که دسترسی «تحلیل آزمون‌ها» دارند */
questionnairesRouter.patch("/:id/analysis", requireStaff, async (req, res) => {
  if (!(await isAnalyst(req))) throw forbidden();
  const body = validate(z.object({ analysis: z.string().max(20000).optional(), shareWithPatient: z.boolean().optional(), finalize: z.boolean().optional() }), req.body);
  const r = await prisma.questionnaireResponse.findUnique({ where: { id: String(req.params.id) } });
  if (!r || !["SUBMITTED", "ANALYZED"].includes(r.status)) throw badRequest("این پرسشنامه هنوز تکمیل نشده است");
  const finalize = body.finalize ?? r.status === "ANALYZED";
  const share = body.shareWithPatient ?? r.shareWithPatient;
  const out = await prisma.questionnaireResponse.update({
    where: { id: r.id },
    data: { analysis: body.analysis ?? r.analysis, shareWithPatient: share, ...(finalize ? { status: "ANALYZED", analyzedById: req.user!.id, analyzedAt: r.analyzedAt ?? new Date() } : {}) },
  });
  if (finalize && share && (!r.shareWithPatient || r.status !== "ANALYZED")) await notifyAnalysisShared(r.id);
  await audit(req.user!.id, "analyze", "questionnaire", r.id, { finalize, share });
  res.json({ item: shape(out) });
});

questionnairesRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const r = await prisma.questionnaireResponse.findUnique({ where: { id: String(req.params.id) } });
  if (!r) throw notFound();
  await prisma.questionnaireResponse.delete({ where: { id: r.id } });
  await audit(req.user!.id, "delete", "questionnaire", r.id);
  res.json({ ok: true });
});

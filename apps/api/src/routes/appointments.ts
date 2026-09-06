import { Router } from "express";
import { z } from "zod";
import { APPOINTMENT_STATUSES, formatJalaliLong, formatTime, startOfDay, endOfDay } from "@toranj/shared";
import { prisma } from "../lib/prisma.js";
import { validate, zDate, zOptionalString, zOptionalInt } from "../lib/validate.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { requireAuth, requireStaff, requireAdminOrSecretary } from "../middleware/auth.js";
import { sendTemplateSms } from "../lib/sms/service.js";
import { getSettingBool, getSettingNumber } from "../lib/settings.js";
import { notifyUser } from "../lib/notify.js";
import { audit } from "../lib/audit.js";

export const appointmentsRouter = Router();
appointmentsRouter.use(requireAuth);

const include = {
  patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true, phone: true, userId: true } },
  therapist: { select: { id: true, color: true, user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
} as const;

function shape(a: any) {
  return {
    ...a,
    patientName: `${a.patient.firstName} ${a.patient.lastName}`,
    therapistName: `${a.therapist.user.firstName} ${a.therapist.user.lastName}`,
    therapistColor: a.therapist.color,
  };
}

async function assertNoConflict(therapistId: string, patientId: string, startAt: Date, endAt: Date, excludeId?: string) {
  const conflict = await prisma.appointment.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      OR: [{ therapistId }, { patientId }],
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    include,
  });
  if (conflict) {
    const who = conflict.therapistId === therapistId ? "درمانگر" : "بیمار";
    throw badRequest(`تداخل زمانی: ${who} در این بازه نوبت دیگری دارد (${formatTime(conflict.startAt)} تا ${formatTime(conflict.endAt)})`);
  }
}

const apptSchema = z.object({
  patientId: z.string().min(1, "بیمار را انتخاب کنید"),
  therapistId: z.string().min(1, "درمانگر را انتخاب کنید"),
  startAt: zDate,
  durationMin: zOptionalInt,
  room: zOptionalString,
  notes: zOptionalString,
  price: zOptionalInt,
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});

/** فهرست نوبت‌ها با فیلتر تاریخ/درمانگر/بیمار/وضعیت؛ هر نقش فقط موارد مربوط به خود را می‌بیند */
appointmentsRouter.get("/", async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : startOfDay(new Date());
  const to = req.query.to ? new Date(String(req.query.to)) : endOfDay(from);
  const where: any = { startAt: { gte: from, lte: to } };
  if (req.query.therapistId) where.therapistId = String(req.query.therapistId);
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  if (req.query.status) where.status = String(req.query.status);
  if (req.user!.role === "THERAPIST") where.therapistId = req.user!.therapistId;
  if (req.user!.role === "PATIENT") where.patientId = req.user!.patientId;
  const rows = await prisma.appointment.findMany({ where, include, orderBy: { startAt: "asc" } });
  res.json({ items: rows.map(shape) });
});

/** نوبت‌های آینده کاربر جاری (بیمار/درمانگر) */
appointmentsRouter.get("/mine", async (req, res) => {
  const where: any = { startAt: { gte: startOfDay(new Date()) }, status: { in: ["SCHEDULED", "CONFIRMED"] } };
  if (req.user!.role === "THERAPIST") where.therapistId = req.user!.therapistId;
  else if (req.user!.role === "PATIENT") where.patientId = req.user!.patientId;
  const rows = await prisma.appointment.findMany({ where, include, orderBy: { startAt: "asc" }, take: 50 });
  res.json({ items: rows.map(shape) });
});

appointmentsRouter.post("/", requireStaff, async (req, res) => {
  const body = validate(apptSchema, req.body);
  const duration = body.durationMin ?? (await getSettingNumber("schedule.defaultDuration", 45));
  const endAt = new Date(body.startAt.getTime() + duration * 60000);
  await assertNoConflict(body.therapistId, body.patientId, body.startAt, endAt);
  const therapist = await prisma.therapist.findUnique({ where: { id: body.therapistId } });
  const price = body.price ?? therapist?.sessionPrice ?? (await getSettingNumber("schedule.defaultSessionPrice", 0));
  const a = await prisma.appointment.create({
    data: { patientId: body.patientId, therapistId: body.therapistId, startAt: body.startAt, endAt, room: body.room ?? null, notes: body.notes ?? null, price, status: body.status ?? "SCHEDULED", createdById: req.user!.id },
    include,
  });
  await audit(req.user!.id, "create", "appointment", a.id);
  res.status(201).json({ appointment: shape(a) });
});

appointmentsRouter.patch("/:id", requireStaff, async (req, res) => {
  const body = validate(apptSchema.partial(), req.body);
  const cur = await prisma.appointment.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound("نوبت یافت نشد");
  if (req.user!.role === "THERAPIST" && cur.therapistId !== req.user!.therapistId) throw forbidden();
  const startAt = body.startAt ?? cur.startAt;
  const duration = body.durationMin ?? Math.round((cur.endAt.getTime() - cur.startAt.getTime()) / 60000);
  const endAt = new Date(startAt.getTime() + duration * 60000);
  const therapistId = body.therapistId ?? cur.therapistId;
  const patientId = body.patientId ?? cur.patientId;
  const status = body.status ?? cur.status;
  if (status === "SCHEDULED" || status === "CONFIRMED") await assertNoConflict(therapistId, patientId, startAt, endAt, cur.id);
  const a = await prisma.appointment.update({
    where: { id: cur.id },
    data: { patientId, therapistId, startAt, endAt, status, room: body.room === undefined ? cur.room : body.room, notes: body.notes === undefined ? cur.notes : body.notes, price: body.price === undefined ? cur.price : body.price },
    include,
  });
  if (status === "CANCELLED" && cur.status !== "CANCELLED") {
    sendTemplateSms("appointment_cancelled", a.patient.phone, { name: `${a.patient.firstName} ${a.patient.lastName}`, date: formatJalaliLong(a.startAt), time: formatTime(a.startAt) }, { related: { type: "appointment", id: a.id } }).catch(console.error);
  }
  await audit(req.user!.id, "update", "appointment", a.id, body);
  res.json({ appointment: shape(a) });
});

appointmentsRouter.delete("/:id", requireAdminOrSecretary, async (req, res) => {
  await prisma.appointment.delete({ where: { id: String(req.params.id) } });
  await audit(req.user!.id, "delete", "appointment", String(req.params.id));
  res.json({ ok: true });
});

/**
 * قطعی‌کردن برنامه یک روز: همه نوبت‌های SCHEDULED آن روز به CONFIRMED تبدیل می‌شوند و
 * به بیماران (هر نوبت) و درمانگران (خلاصه روز) پیامک و اعلان درون‌برنامه ارسال می‌شود.
 */
appointmentsRouter.post("/fix-day", requireAdminOrSecretary, async (req, res) => {
  const body = validate(z.object({ date: zDate, therapistId: z.string().optional(), resend: z.boolean().optional() }), req.body);
  const where: any = { startAt: { gte: startOfDay(body.date), lte: endOfDay(body.date) }, status: { in: ["SCHEDULED", "CONFIRMED"] } };
  if (body.therapistId) where.therapistId = body.therapistId;
  const rows = await prisma.appointment.findMany({ where, include, orderBy: { startAt: "asc" } });
  const now = new Date();
  const autoSms = await getSettingBool("sms.autoOnFix", true);
  let smsCount = 0;
  const byTherapist = new Map<string, typeof rows>();
  for (const a of rows) {
    const shouldSms = autoSms && (body.resend || !a.smsFixedSentAt);
    await prisma.appointment.update({ where: { id: a.id }, data: { status: "CONFIRMED", fixedAt: a.fixedAt ?? now } });
    if (shouldSms) {
      await sendTemplateSms(
        "appointment_fixed",
        a.patient.phone,
        { name: `${a.patient.firstName} ${a.patient.lastName}`, therapist: `${a.therapist.user.firstName} ${a.therapist.user.lastName}`, date: formatJalaliLong(a.startAt), time: formatTime(a.startAt) },
        { related: { type: "appointment", id: a.id } },
      );
      await prisma.appointment.update({ where: { id: a.id }, data: { smsFixedSentAt: now } });
      smsCount += 1;
    }
    await notifyUser(a.patient.userId, "نوبت شما قطعی شد", `${formatJalaliLong(a.startAt, true)} ساعت ${formatTime(a.startAt)} با ${a.therapist.user.firstName} ${a.therapist.user.lastName}`, "/panel/my/schedule");
    const list = byTherapist.get(a.therapistId) ?? [];
    list.push(a);
    byTherapist.set(a.therapistId, list);
  }
  for (const [, list] of byTherapist) {
    const t = list[0].therapist;
    const first = list[0];
    if (autoSms && (body.resend || list.some((a) => !a.smsFixedSentAt))) {
      await sendTemplateSms(
        "appointment_fixed_therapist",
        t.user.phone,
        { name: `${t.user.firstName} ${t.user.lastName}`, date: formatJalaliLong(first.startAt), count: list.length, time: formatTime(first.startAt) },
        { related: { type: "user", id: t.user.id } },
      );
      smsCount += 1;
    }
    await notifyUser(t.user.id, `برنامه ${formatJalaliLong(first.startAt)} قطعی شد`, `${list.length} جلسه؛ اولین جلسه ساعت ${formatTime(first.startAt)}`, "/panel/schedule");
  }
  await audit(req.user!.id, "fix-day", "appointment", null, { date: body.date, count: rows.length });
  res.json({ ok: true, confirmed: rows.length, smsSent: smsCount });
});

/** کپی برنامه یک روز به روز دیگر (برای بیماران با برنامه ثابت هفتگی) */
appointmentsRouter.post("/copy-day", requireAdminOrSecretary, async (req, res) => {
  const body = validate(z.object({ from: zDate, to: zDate, therapistId: z.string().optional() }), req.body);
  const where: any = { startAt: { gte: startOfDay(body.from), lte: endOfDay(body.from) }, status: { in: ["SCHEDULED", "CONFIRMED", "DONE"] } };
  if (body.therapistId) where.therapistId = body.therapistId;
  const rows = await prisma.appointment.findMany({ where });
  let created = 0;
  for (const a of rows) {
    const s = new Date(body.to);
    s.setHours(a.startAt.getHours(), a.startAt.getMinutes(), 0, 0);
    const e = new Date(s.getTime() + (a.endAt.getTime() - a.startAt.getTime()));
    try {
      await assertNoConflict(a.therapistId, a.patientId, s, e);
      await prisma.appointment.create({ data: { patientId: a.patientId, therapistId: a.therapistId, startAt: s, endAt: e, room: a.room, price: a.price, createdById: req.user!.id } });
      created += 1;
    } catch {
      /* تداخل: رد می‌شود */
    }
  }
  res.json({ ok: true, created, skipped: rows.length - created });
});

/** آمار حضور و غیاب */
appointmentsRouter.get("/stats", requireStaff, async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const where: any = { startAt: { gte: from, lte: to } };
  if (req.user!.role === "THERAPIST") where.therapistId = req.user!.therapistId;
  const groups = await prisma.appointment.groupBy({ by: ["status"], where, _count: { _all: true } });
  res.json({ counts: Object.fromEntries(groups.map((g) => [g.status, g._count._all])) });
});

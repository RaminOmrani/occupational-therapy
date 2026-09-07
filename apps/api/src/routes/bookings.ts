import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { normalizePhone, isValidMobile, startOfDay, endOfDay, addDays, formatJalaliLong, formatTime } from "@toranj/shared";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zDate, zOptionalString } from "../lib/validate.js";
import { badRequest, notFound } from "../lib/errors.js";
import { getSetting, getSettingBool, getSettingNumber } from "../lib/settings.js";
import { requireAuth, requireAdminOrSecretary } from "../middleware/auth.js";
import { nextNumber } from "../lib/numbering.js";
import { notifyRole, notifyUser } from "../lib/notify.js";
import { sendTemplateSms } from "../lib/sms/service.js";
import { ensurePatientAccount } from "./patients.js";
import { audit } from "../lib/audit.js";

/** ---------- بخش عمومی (سایت) ---------- */
export const publicBookingRouter = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: "درخواست‌های زیاد؛ لطفاً بعداً تلاش کنید" } });

publicBookingRouter.get("/config", async (_req, res) => {
  const enabled = await getSettingBool("booking.enabled", true);
  const therapists = enabled
    ? await prisma.therapist.findMany({ where: { isPublic: true, user: { isActive: true } }, include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { sortOrder: "asc" } })
    : [];
  res.json({
    enabled,
    daysAhead: await getSettingNumber("booking.daysAhead", 14),
    duration: await getSettingNumber("schedule.defaultDuration", 45),
    therapists: therapists.map((t) => ({ id: t.id, fullName: `${t.user.firstName} ${t.user.lastName}`, specialty: t.specialty, color: t.color, workDays: parseJson<number[]>(t.workDays, []) })),
  });
});

/** زمان‌های خالی یک درمانگر در یک روز */
publicBookingRouter.get("/slots", async (req, res) => {
  if (!(await getSettingBool("booking.enabled", true))) throw badRequest("نوبت‌دهی آنلاین غیرفعال است");
  const therapistId = String(req.query.therapistId ?? "");
  const date = new Date(String(req.query.date ?? ""));
  if (!therapistId || isNaN(date.getTime())) throw badRequest("درمانگر و تاریخ الزامی است");
  const daysAhead = await getSettingNumber("booking.daysAhead", 14);
  if (date < startOfDay(new Date()) || date > addDays(new Date(), daysAhead)) return res.json({ slots: [] });
  const t = await prisma.therapist.findUnique({ where: { id: therapistId } });
  if (!t) throw notFound();
  const workDays = parseJson<number[]>(t.workDays, []);
  if (!workDays.includes(date.getDay())) return res.json({ slots: [], offDay: true });
  const startHour = await getSettingNumber("schedule.startHour", 8);
  const endHour = await getSettingNumber("schedule.endHour", 20);
  const duration = await getSettingNumber("schedule.defaultDuration", 45);
  const slotMin = Math.max(15, await getSettingNumber("schedule.slotMinutes", 15));
  const [appts, pending] = await Promise.all([
    prisma.appointment.findMany({ where: { therapistId, startAt: { gte: startOfDay(date), lte: endOfDay(date) }, status: { in: ["SCHEDULED", "CONFIRMED"] } }, select: { startAt: true, endAt: true } }),
    prisma.bookingRequest.findMany({ where: { therapistId, startAt: { gte: startOfDay(date), lte: endOfDay(date) }, status: "PENDING" }, select: { startAt: true, endAt: true } }),
  ]);
  const busy = [...appts, ...pending];
  const slots: string[] = [];
  const now = new Date();
  for (let m = startHour * 60; m + duration <= endHour * 60; m += slotMin) {
    const s = new Date(date); s.setHours(Math.floor(m / 60), m % 60, 0, 0);
    const e = new Date(s.getTime() + duration * 60000);
    if (s <= now) continue;
    if (busy.some((b) => b.startAt < e && b.endAt > s)) continue;
    slots.push(s.toISOString());
  }
  res.json({ slots, duration });
});

publicBookingRouter.post("/", limiter, async (req, res) => {
  if (!(await getSettingBool("booking.enabled", true))) throw badRequest("نوبت‌دهی آنلاین غیرفعال است");
  const body = validate(z.object({ therapistId: z.string().min(1), startAt: zDate, firstName: z.string().min(1, "نام الزامی است"), lastName: z.string().min(1, "نام خانوادگی الزامی است"), phone: z.string().min(10), note: zOptionalString }), req.body);
  const phone = normalizePhone(body.phone);
  if (!isValidMobile(phone)) throw badRequest("شماره موبایل معتبر نیست");
  const duration = await getSettingNumber("schedule.defaultDuration", 45);
  const endAt = new Date(body.startAt.getTime() + duration * 60000);
  const conflict = await prisma.appointment.findFirst({ where: { therapistId: body.therapistId, status: { in: ["SCHEDULED", "CONFIRMED"] }, startAt: { lt: endAt }, endAt: { gt: body.startAt } } });
  const pendingConflict = await prisma.bookingRequest.findFirst({ where: { therapistId: body.therapistId, status: "PENDING", startAt: { lt: endAt }, endAt: { gt: body.startAt } } });
  if (conflict || pendingConflict) throw badRequest("این زمان به‌تازگی رزرو شده است؛ زمان دیگری انتخاب کنید");
  const existingPatient = await prisma.patient.findFirst({ where: { phone } });
  const br = await prisma.bookingRequest.create({ data: { therapistId: body.therapistId, startAt: body.startAt, endAt, firstName: body.firstName, lastName: body.lastName, phone, note: body.note ?? null, patientId: existingPatient?.id ?? null } });
  if (!existingPatient) {
    const lead = await prisma.lead.findFirst({ where: { phone, status: { in: ["NEW", "CONTACTED", "INTERESTED"] } } });
    if (!lead) await prisma.lead.create({ data: { leadNumber: await nextNumber("lead", "L-"), firstName: body.firstName, lastName: body.lastName, phone, source: "WEBSITE", interest: `درخواست نوبت آنلاین ${formatJalaliLong(body.startAt)} ${formatTime(body.startAt)}` } });
  }
  const msg = `${body.firstName} ${body.lastName} برای ${formatJalaliLong(body.startAt)} ساعت ${formatTime(body.startAt)}`;
  await notifyRole("SECRETARY", "درخواست نوبت آنلاین", msg, "/panel/bookings");
  await notifyRole("ADMIN", "درخواست نوبت آنلاین", msg, "/panel/bookings");
  res.status(201).json({ ok: true, id: br.id, message: "درخواست شما ثبت شد. پس از تأیید کلینیک، پیامک تأیید دریافت می‌کنید." });
});

/** ---------- بخش کارکنان ---------- */
export const bookingsRouter = Router();
bookingsRouter.use(requireAuth, requireAdminOrSecretary);

const include = { therapist: { select: { id: true, color: true, user: { select: { firstName: true, lastName: true } } } } } as const;
const shape = (b: any) => ({ ...b, fullName: `${b.firstName} ${b.lastName}`, therapistName: `${b.therapist.user.firstName} ${b.therapist.user.lastName}` });

bookingsRouter.get("/", async (req, res) => {
  const status = String(req.query.status ?? "PENDING");
  const items = await prisma.bookingRequest.findMany({ where: status ? { status } : {}, include, orderBy: { startAt: "asc" }, take: 200 });
  const pendingCount = await prisma.bookingRequest.count({ where: { status: "PENDING" } });
  res.json({ items: items.map(shape), pendingCount });
});

bookingsRouter.post("/:id/approve", async (req, res) => {
  const b = await prisma.bookingRequest.findUnique({ where: { id: String(req.params.id) }, include });
  if (!b || b.status !== "PENDING") throw notFound("درخواست یافت نشد یا قبلاً بررسی شده");
  let patient = b.patientId ? await prisma.patient.findUnique({ where: { id: b.patientId } }) : await prisma.patient.findFirst({ where: { phone: b.phone } });
  if (!patient) {
    patient = await prisma.patient.create({ data: { fileNumber: await nextNumber("patient", "OT-"), firstName: b.firstName, lastName: b.lastName, phone: b.phone, primaryTherapistId: b.therapistId, referralSource: "نوبت‌دهی آنلاین سایت" } });
    await ensurePatientAccount(patient.id).catch(() => null);
    await prisma.lead.updateMany({ where: { phone: b.phone, status: { not: "LOST" } }, data: { status: "CONVERTED" } });
  }
  const conflict = await prisma.appointment.findFirst({ where: { therapistId: b.therapistId, status: { in: ["SCHEDULED", "CONFIRMED"] }, startAt: { lt: b.endAt }, endAt: { gt: b.startAt } } });
  if (conflict) throw badRequest("در این زمان نوبت دیگری ثبت شده است؛ درخواست را رد کنید یا نوبت موجود را جابه‌جا کنید");
  const therapist = await prisma.therapist.findUnique({ where: { id: b.therapistId } });
  const appt = await prisma.appointment.create({ data: { patientId: patient.id, therapistId: b.therapistId, startAt: b.startAt, endAt: b.endAt, status: "SCHEDULED", source: "WEB", price: therapist?.sessionPrice ?? (await getSettingNumber("schedule.defaultSessionPrice", 0)), notes: b.note, createdById: req.user!.id } });
  await prisma.bookingRequest.update({ where: { id: b.id }, data: { status: "APPROVED", patientId: patient.id, appointmentId: appt.id, handledById: req.user!.id, handledAt: new Date() } });
  if (await getSettingBool("booking.autoSms", true)) {
    sendTemplateSms("booking_approved", b.phone, { name: `${b.firstName} ${b.lastName}`, date: formatJalaliLong(b.startAt), time: formatTime(b.startAt), therapist: `${b.therapist.user.firstName} ${b.therapist.user.lastName}` }, { related: { type: "appointment", id: appt.id } }).catch(console.error);
  }
  await notifyUser(patient.userId, "نوبت شما ثبت شد", `${formatJalaliLong(b.startAt, true)} ساعت ${formatTime(b.startAt)}`, "/panel/my/schedule");
  await audit(req.user!.id, "approve", "booking", b.id);
  res.json({ ok: true, patientId: patient.id, appointmentId: appt.id });
});

bookingsRouter.post("/:id/reject", async (req, res) => {
  const b = await prisma.bookingRequest.findUnique({ where: { id: String(req.params.id) } });
  if (!b || b.status !== "PENDING") throw notFound();
  await prisma.bookingRequest.update({ where: { id: b.id }, data: { status: "REJECTED", handledById: req.user!.id, handledAt: new Date() } });
  if (await getSettingBool("booking.autoSms", true)) {
    sendTemplateSms("booking_rejected", b.phone, { name: `${b.firstName} ${b.lastName}`, date: formatJalaliLong(b.startAt), time: formatTime(b.startAt), phone: await getSetting("clinic.phone") }, { related: { type: "booking", id: b.id } }).catch(console.error);
  }
  res.json({ ok: true });
});

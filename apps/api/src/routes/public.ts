import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { normalizePhone, isValidMobile, FEEDBACK_TYPES } from "@toranj/shared";
import { prisma } from "../lib/prisma.js";
import { validate, zOptionalString } from "../lib/validate.js";
import { badRequest } from "../lib/errors.js";
import { getPublicSettings, getSettingBool } from "../lib/settings.js";
import { nextNumber } from "../lib/numbering.js";
import { notifyRole } from "../lib/notify.js";

export const publicRouter = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: "درخواست‌های زیاد؛ لطفاً بعداً تلاش کنید" } });

/** اطلاعات کلینیک + درمانگران عمومی برای سایت */
publicRouter.get("/clinic", async (_req, res) => {
  const settings = await getPublicSettings();
  const showTherapists = await getSettingBool("public.showTherapists", true);
  const therapists = showTherapists
    ? await prisma.therapist.findMany({ where: { isPublic: true, user: { isActive: true } }, include: { user: { select: { firstName: true, lastName: true, avatar: true } } }, orderBy: { sortOrder: "asc" } })
    : [];
  const [patientsCount, sessionsCount, articlesCount] = await Promise.all([prisma.patient.count(), prisma.appointment.count({ where: { status: "DONE" } }), prisma.article.count({ where: { published: true } })]);
  res.json({
    settings,
    therapists: therapists.map((t) => ({ id: t.id, fullName: `${t.user.firstName} ${t.user.lastName}`, specialty: t.specialty, bio: t.bio, avatar: t.user.avatar, color: t.color })),
    stats: { patients: patientsCount, sessions: sessionsCount, articles: articlesCount },
  });
});

/** فرم تماس/درخواست نوبت سایت → تبدیل به لید در CRM */
publicRouter.post("/contact", limiter, async (req, res) => {
  const body = validate(z.object({ firstName: z.string().min(1, "نام الزامی است"), lastName: z.string().optional(), phone: z.string().min(10, "شماره تماس الزامی است"), message: zOptionalString }), req.body);
  const phone = normalizePhone(body.phone);
  if (!isValidMobile(phone)) throw badRequest("شماره موبایل معتبر نیست");
  const existing = await prisma.lead.findFirst({ where: { phone, status: { in: ["NEW", "CONTACTED", "INTERESTED"] } } });
  const lead =
    existing ??
    (await prisma.lead.create({ data: { leadNumber: await nextNumber("lead", "L-"), firstName: body.firstName, lastName: body.lastName ?? "", phone, source: "WEBSITE", interest: body.message ?? null } }));
  await prisma.leadActivity.create({ data: { leadId: lead.id, type: "NOTE", content: `درخواست از سایت: ${body.message ?? "بدون توضیح"}`, byName: "سایت" } });
  await notifyRole("ADMIN", "درخواست جدید از سایت", `${body.firstName} ${body.lastName ?? ""} - ${phone}`, `/panel/leads/${lead.id}`);
  await notifyRole("SECRETARY", "درخواست جدید از سایت", `${body.firstName} ${body.lastName ?? ""} - ${phone}`, `/panel/leads/${lead.id}`);
  res.status(201).json({ ok: true, message: "درخواست شما ثبت شد؛ به‌زودی با شما تماس می‌گیریم" });
});

/** انتقاد/پیشنهاد مهمان از سایت */
publicRouter.post("/feedback", limiter, async (req, res) => {
  const body = validate(z.object({ type: z.enum(FEEDBACK_TYPES), subject: z.string().min(1), message: z.string().min(1), guestName: zOptionalString, guestPhone: zOptionalString }), req.body);
  await prisma.feedback.create({ data: { ...body, guestPhone: body.guestPhone ? normalizePhone(body.guestPhone) : null } });
  await notifyRole("ADMIN", "انتقاد/پیشنهاد از سایت", body.subject, "/panel/feedback");
  res.status(201).json({ ok: true });
});

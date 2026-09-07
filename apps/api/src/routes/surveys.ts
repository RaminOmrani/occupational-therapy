import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { validate, zOptionalString } from "../lib/validate.js";
import { notFound, badRequest } from "../lib/errors.js";
import { getSetting } from "../lib/settings.js";
import { notifyRole } from "../lib/notify.js";
import { requireAuth, requireAdminOrSecretary } from "../middleware/auth.js";

export const publicSurveyRouter = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

publicSurveyRouter.get("/:token", async (req, res) => {
  const t = await prisma.surveyToken.findUnique({ where: { token: String(req.params.token) }, include: { patient: { select: { firstName: true, lastName: true } } } });
  if (!t) throw notFound("لینک نامعتبر است");
  res.json({ name: `${t.patient.firstName} ${t.patient.lastName}`, sessionCount: t.sessionCount, used: !!t.usedAt, clinic: await getSetting("clinic.name") });
});

publicSurveyRouter.post("/:token", limiter, async (req, res) => {
  const t = await prisma.surveyToken.findUnique({ where: { token: String(req.params.token) }, include: { patient: true } });
  if (!t) throw notFound("لینک نامعتبر است");
  if (t.usedAt) throw badRequest("این نظرسنجی قبلاً ثبت شده است");
  const body = validate(z.object({ rating: z.number().int().min(1).max(5), comment: zOptionalString }), req.body);
  await prisma.surveyToken.update({ where: { id: t.id }, data: { usedAt: new Date(), rating: body.rating, comment: body.comment ?? null } });
  await prisma.feedback.create({ data: { patientId: t.patientId, type: body.rating >= 4 ? "PRAISE" : body.rating <= 2 ? "COMPLAINT" : "SUGGESTION", subject: `رضایت‌سنجی پس از ${t.sessionCount} جلسه`, message: body.comment || `امتیاز ${body.rating} از ۵`, rating: body.rating } });
  if (body.rating <= 2) await notifyRole("ADMIN", "رضایت پایین در نظرسنجی", `${t.patient.firstName} ${t.patient.lastName}: امتیاز ${body.rating}/۵`, "/panel/feedback");
  res.json({ ok: true });
});

export const surveysRouter = Router();
surveysRouter.use(requireAuth, requireAdminOrSecretary);
surveysRouter.get("/", async (_req, res) => {
  const items = await prisma.surveyToken.findMany({ orderBy: { sentAt: "desc" }, take: 200, include: { patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true } } } });
  const answered = items.filter((i) => i.usedAt);
  const avg = answered.length ? answered.reduce((s, i) => s + (i.rating ?? 0), 0) / answered.length : null;
  res.json({ items, stats: { sent: items.length, answered: answered.length, avg } });
});

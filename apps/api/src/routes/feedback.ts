import { Router } from "express";
import { z } from "zod";
import { FEEDBACK_TYPES, FEEDBACK_STATUSES } from "@toranj/shared";
import { prisma } from "../lib/prisma.js";
import { validate, zOptionalString, zOptionalInt } from "../lib/validate.js";
import { forbidden, notFound } from "../lib/errors.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { notifyRole, notifyUser } from "../lib/notify.js";

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

feedbackRouter.get("/", async (req, res) => {
  const where: any = {};
  if (req.user!.role === "PATIENT") where.patientId = req.user!.patientId;
  else {
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.type) where.type = String(req.query.type);
    if (req.query.patientId) where.patientId = String(req.query.patientId);
  }
  const items = await prisma.feedback.findMany({ where, include: { patient: { select: { firstName: true, lastName: true, fileNumber: true } }, repliedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } });
  res.json({ items });
});

feedbackRouter.post("/", async (req, res) => {
  const body = validate(z.object({ type: z.enum(FEEDBACK_TYPES), subject: z.string().min(1, "موضوع الزامی است"), message: z.string().min(1, "متن پیام الزامی است"), rating: zOptionalInt, patientId: zOptionalString }), req.body);
  const patientId = req.user!.role === "PATIENT" ? req.user!.patientId : (body.patientId ?? null);
  const f = await prisma.feedback.create({ data: { type: body.type, subject: body.subject, message: body.message, rating: body.rating ?? null, patientId } });
  await notifyRole("ADMIN", "انتقاد/پیشنهاد جدید", body.subject, "/panel/feedback");
  res.status(201).json({ feedback: f });
});

feedbackRouter.patch("/:id", requireStaff, async (req, res) => {
  const body = validate(z.object({ status: z.enum(FEEDBACK_STATUSES).optional(), reply: zOptionalString }), req.body);
  const cur = await prisma.feedback.findUnique({ where: { id: String(req.params.id) }, include: { patient: { select: { userId: true } } } });
  if (!cur) throw notFound();
  const data: any = { ...body };
  if (body.reply) {
    data.repliedById = req.user!.id;
    data.repliedAt = new Date();
    data.status = body.status ?? "RESOLVED";
    await notifyUser(cur.patient?.userId, "پاسخ به پیام شما", body.reply.slice(0, 120), "/panel/my/feedback");
  }
  const f = await prisma.feedback.update({ where: { id: cur.id }, data });
  res.json({ feedback: f });
});

feedbackRouter.delete("/:id", requireStaff, async (req, res) => {
  if (req.user!.role !== "ADMIN") throw forbidden();
  await prisma.feedback.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

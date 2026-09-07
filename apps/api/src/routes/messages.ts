import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../lib/validate.js";
import { forbidden, notFound } from "../lib/errors.js";
import { requireAuth, requireStaff, canAccessPatient } from "../middleware/auth.js";
import { notifyUser } from "../lib/notify.js";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

const senderSel = { sender: { select: { id: true, firstName: true, lastName: true, role: true } } } as const;

/** فهرست گفتگوها (کارکنان): بیمارانی که پیام دارند + تعداد نخوانده */
messagesRouter.get("/conversations", requireStaff, async (req, res) => {
  const where: any = {};
  if (req.user!.role === "THERAPIST" && req.query.all !== "1") where.patient = { primaryTherapistId: req.user!.therapistId };
  const msgs = await prisma.message.findMany({ where, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true } } } });
  const map = new Map<string, any>();
  for (const m of msgs) {
    const c = map.get(m.patientId) ?? { patient: m.patient, last: m, unread: 0 };
    if (m.senderRole === "PATIENT" && !m.readAt) c.unread += 1;
    map.set(m.patientId, c);
  }
  res.json({ items: [...map.values()] });
});

/** تعداد پیام‌های نخوانده کاربر جاری (برای نشانگر منو) */
messagesRouter.get("/unread", async (req, res) => {
  if (req.user!.role === "PATIENT") {
    const n = await prisma.message.count({ where: { patientId: req.user!.patientId!, senderRole: { not: "PATIENT" }, readAt: null } });
    return res.json({ unread: n });
  }
  const where: any = { senderRole: "PATIENT", readAt: null };
  if (req.user!.role === "THERAPIST") where.patient = { primaryTherapistId: req.user!.therapistId };
  res.json({ unread: await prisma.message.count({ where }) });
});

async function thread(patientId: string, viewerRole: string) {
  const items = await prisma.message.findMany({ where: { patientId }, orderBy: { createdAt: "asc" }, include: senderSel, take: 300 });
  // خوانده‌شدن پیام‌های طرف مقابل
  await prisma.message.updateMany({ where: { patientId, readAt: null, senderRole: viewerRole === "PATIENT" ? { not: "PATIENT" } : "PATIENT" }, data: { readAt: new Date() } });
  return items;
}

messagesRouter.get("/mine", async (req, res) => {
  if (req.user!.role !== "PATIENT") throw forbidden();
  res.json({ items: await thread(req.user!.patientId!, "PATIENT") });
});

messagesRouter.get("/:patientId", async (req, res) => {
  const patientId = String(req.params.patientId);
  if (!canAccessPatient(req, patientId)) throw forbidden();
  const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, firstName: true, lastName: true, fileNumber: true, primaryTherapist: { select: { user: { select: { id: true, firstName: true, lastName: true } } } } } });
  if (!p) throw notFound();
  res.json({ patient: p, items: await thread(patientId, req.user!.role) });
});

messagesRouter.post("/:patientId", async (req, res) => {
  const patientId = req.params.patientId === "mine" ? req.user!.patientId! : String(req.params.patientId);
  if (!canAccessPatient(req, patientId)) throw forbidden();
  const body = validate(z.object({ body: z.string().min(1, "متن پیام خالی است").max(2000) }), req.body);
  const m = await prisma.message.create({ data: { patientId, senderUserId: req.user!.id, senderRole: req.user!.role, body: body.body }, include: senderSel });
  const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { userId: true, firstName: true, lastName: true, primaryTherapist: { select: { userId: true } } } });
  if (req.user!.role === "PATIENT") {
    await notifyUser(p?.primaryTherapist?.userId, `پیام جدید از ${p?.firstName} ${p?.lastName}`, body.body.slice(0, 100), `/panel/messages/${patientId}`);
    const admins = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "SECRETARY"] }, isActive: true }, select: { id: true } });
    await Promise.all(admins.map((a) => notifyUser(a.id, `پیام جدید از ${p?.firstName} ${p?.lastName}`, body.body.slice(0, 100), `/panel/messages/${patientId}`)));
  } else {
    await notifyUser(p?.userId, `پیام جدید از ${req.user!.firstName} ${req.user!.lastName}`, body.body.slice(0, 100), "/panel/my/messages");
  }
  res.status(201).json({ message: m });
});

import { Router } from "express";
import { z } from "zod";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zOptionalString } from "../lib/validate.js";
import { notFound } from "../lib/errors.js";
import { requireAuth, requireStaff, requireAdminOrSecretary } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";

/** لیست انتظار نوبت */
export const waitlistRouter = Router();
waitlistRouter.use(requireAuth, requireStaff);

const include = { patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true, phone: true } }, therapist: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } } as const;
const shape = (e: any) => ({ ...e, preferredDays: parseJson<number[]>(e.preferredDays, []), patientName: `${e.patient.firstName} ${e.patient.lastName}`, therapistName: e.therapist ? `${e.therapist.user.firstName} ${e.therapist.user.lastName}` : null });

waitlistRouter.get("/", async (req, res) => {
  const status = String(req.query.status ?? "ACTIVE");
  const where: any = status === "ALL" ? {} : { status };
  if (req.query.therapistId) where.therapistId = String(req.query.therapistId);
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  const items = await prisma.waitlistEntry.findMany({ where, include, orderBy: { createdAt: "asc" } });
  res.json({ items: items.map(shape) });
});

const schema = z.object({ patientId: z.string().min(1), therapistId: zOptionalString, preferredDays: z.array(z.number().int().min(0).max(6)).optional(), preferredTime: zOptionalString, note: zOptionalString });

waitlistRouter.post("/", async (req, res) => {
  const body = validate(schema, req.body);
  const dup = await prisma.waitlistEntry.findFirst({ where: { patientId: body.patientId, status: "ACTIVE", therapistId: body.therapistId ?? null } });
  if (dup) return res.json({ entry: shape(await prisma.waitlistEntry.findUnique({ where: { id: dup.id }, include })), duplicate: true });
  const e = await prisma.waitlistEntry.create({ data: { patientId: body.patientId, therapistId: body.therapistId ?? null, preferredDays: JSON.stringify(body.preferredDays ?? []), preferredTime: body.preferredTime ?? null, note: body.note ?? null, createdById: req.user!.id }, include });
  await audit(req.user!.id, "create", "waitlist", e.id);
  res.status(201).json({ entry: shape(e) });
});

waitlistRouter.patch("/:id", requireAdminOrSecretary, async (req, res) => {
  const body = validate(schema.partial().extend({ status: z.enum(["ACTIVE", "FULFILLED", "CANCELLED"]).optional() }), req.body);
  const cur = await prisma.waitlistEntry.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound("مورد یافت نشد");
  const data: any = { ...body };
  if (body.preferredDays) data.preferredDays = JSON.stringify(body.preferredDays);
  if (body.therapistId === "") data.therapistId = null;
  const e = await prisma.waitlistEntry.update({ where: { id: cur.id }, data, include });
  res.json({ entry: shape(e) });
});

waitlistRouter.delete("/:id", requireAdminOrSecretary, async (req, res) => {
  await prisma.waitlistEntry.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

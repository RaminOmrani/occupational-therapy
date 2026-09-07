import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { validate } from "../lib/validate.js";
import { forbidden, notFound, badRequest } from "../lib/errors.js";
import { getSetting, getSettingBool } from "../lib/settings.js";
import { requireAuth, requireStaff, canAccessPatient } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";

export const consentsRouter = Router();
consentsRouter.use(requireAuth);

async function currentTemplate() {
  const title = await getSetting("consent.title");
  const content = await getSetting("consent.text");
  const hash = createHash("sha256").update(title + "\n" + content).digest("hex").slice(0, 16);
  return { title, content, hash, required: await getSettingBool("consent.required", true) };
}

/** وضعیت رضایت‌نامه بیمار: آیا نسخه جاری امضا شده؟ */
consentsRouter.get("/status/:patientId", async (req, res) => {
  const patientId = req.params.patientId === "me" ? req.user!.patientId! : String(req.params.patientId);
  if (!canAccessPatient(req, patientId)) throw forbidden();
  const tpl = await currentTemplate();
  const signed = await prisma.consent.findFirst({ where: { patientId, contentHash: tpl.hash }, orderBy: { signedAt: "desc" } });
  const history = await prisma.consent.findMany({ where: { patientId }, orderBy: { signedAt: "desc" }, select: { id: true, title: true, signedAt: true, signerName: true, contentHash: true } });
  res.json({ template: { title: tpl.title, content: tpl.content, required: tpl.required }, signed: signed ? { id: signed.id, signedAt: signed.signedAt, signerName: signed.signerName } : null, pending: tpl.required && !signed, history });
});

consentsRouter.post("/sign", async (req, res) => {
  const body = validate(z.object({ patientId: z.string().optional(), signerName: z.string().min(2, "نام امضاکننده الزامی است"), signatureData: z.string().startsWith("data:image/", "امضا نامعتبر است").max(400_000) }), req.body);
  const patientId = req.user!.role === "PATIENT" ? req.user!.patientId! : body.patientId;
  if (!patientId || !canAccessPatient(req, patientId)) throw forbidden();
  const tpl = await currentTemplate();
  const exists = await prisma.consent.findFirst({ where: { patientId, contentHash: tpl.hash } });
  if (exists) throw badRequest("این نسخه از رضایت‌نامه قبلاً امضا شده است");
  const c = await prisma.consent.create({ data: { patientId, title: tpl.title, content: tpl.content, contentHash: tpl.hash, signerName: body.signerName, signatureData: body.signatureData, ip: req.ip ?? null } });
  await audit(req.user!.id, "sign", "consent", c.id, { patientId });
  res.status(201).json({ consent: { id: c.id, signedAt: c.signedAt } });
});

consentsRouter.get("/:id", async (req, res) => {
  const c = await prisma.consent.findUnique({ where: { id: String(req.params.id) }, include: { patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true } } } });
  if (!c || !canAccessPatient(req, c.patientId)) throw notFound();
  res.json({ consent: c, clinic: await getSetting("clinic.name") });
});

consentsRouter.get("/", requireStaff, async (req, res) => {
  const tpl = await currentTemplate();
  const patients = await prisma.patient.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, fileNumber: true, consents: { where: { contentHash: tpl.hash }, select: { signedAt: true }, take: 1 } } });
  res.json({ items: patients.map((p) => ({ id: p.id, fullName: `${p.firstName} ${p.lastName}`, fileNumber: p.fileNumber, signedAt: p.consents[0]?.signedAt ?? null })), required: tpl.required });
});

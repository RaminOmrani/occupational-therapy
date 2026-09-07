import { Router } from "express";
import { z } from "zod";
import { formatMoney } from "@toranj/shared";
import { prisma } from "../lib/prisma.js";
import { validate, zInt, zOptionalInt, zOptionalString } from "../lib/validate.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { getSetting, getSettingBool, getSettingNumber } from "../lib/settings.js";
import { requireAuth, canAccessPatient, requireAdminOrSecretary } from "../middleware/auth.js";
import { recomputeInvoice, patientFinancialSummary } from "../lib/finance.js";
import { zpRequest, zpVerify, startPayUrl } from "../lib/payment/zarinpal.js";
import { notifyRole, notifyUser } from "../lib/notify.js";
import { audit } from "../lib/audit.js";

export const paymentsRouter = Router();

async function cfg() {
  const provider = await getSetting("payment.provider", "off");
  return { provider, enabled: provider === "zarinpal" && !!(await getSetting("payment.merchantId")), merchantId: await getSetting("payment.merchantId"), sandbox: await getSettingBool("payment.sandbox", true), min: await getSettingNumber("payment.minAmount", 10000) };
}

paymentsRouter.get("/config", requireAuth, async (_req, res) => {
  const c = await cfg();
  res.json({ enabled: c.enabled, provider: c.provider, sandbox: c.sandbox, minAmount: c.min });
});

/** شروع پرداخت آنلاین (بیمار یا کارکنان از طرف بیمار) */
paymentsRouter.post("/start", requireAuth, async (req, res) => {
  const c = await cfg();
  if (!c.enabled) throw badRequest("درگاه پرداخت آنلاین فعال نیست");
  const body = validate(z.object({ patientId: zOptionalString, amount: zInt, purpose: z.enum(["INVOICE", "WALLET"]).default("INVOICE"), invoiceId: zOptionalString }), req.body);
  const patientId = req.user!.role === "PATIENT" ? req.user!.patientId! : body.patientId;
  if (!patientId || !canAccessPatient(req, patientId)) throw forbidden();
  if (body.amount < c.min) throw badRequest(`حداقل مبلغ پرداخت ${formatMoney(c.min)} است`);
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw notFound();
  const intent = await prisma.paymentIntent.create({ data: { patientId, amount: body.amount, purpose: body.purpose, invoiceId: body.invoiceId ?? null, provider: "zarinpal" } });
  const base = (await getSetting("site.baseUrl", "http://localhost:3000")).replace(/\/$/, "");
  const r = await zpRequest({ merchantId: c.merchantId, sandbox: c.sandbox }, { amount: body.amount, description: `${await getSetting("clinic.name")} - ${body.purpose === "WALLET" ? "شارژ کیف پول" : "پرداخت صورت‌حساب"} - ${patient.fileNumber}`, callbackUrl: `${base}/api/payments/callback/${intent.id}`, mobile: patient.phone });
  if (!r.ok) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED", error: r.error } });
    throw badRequest(r.error ?? "خطا در اتصال به درگاه");
  }
  await prisma.paymentIntent.update({ where: { id: intent.id }, data: { authority: r.authority } });
  res.json({ url: startPayUrl({ merchantId: c.merchantId, sandbox: c.sandbox }, r.authority!), intentId: intent.id });
});

/** بازگشت از درگاه: تأیید تراکنش و ثبت پرداخت/شارژ کیف پول، سپس هدایت به پنل */
paymentsRouter.get("/callback/:intentId", async (req, res) => {
  const base = (await getSetting("site.baseUrl", "http://localhost:3000")).replace(/\/$/, "");
  const redirect = (status: string, ref = "") => res.redirect(`${base}/panel/my/finance?payment=${status}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`);
  const intent = await prisma.paymentIntent.findUnique({ where: { id: String(req.params.intentId) }, include: { patient: true } });
  if (!intent) return redirect("invalid");
  if (intent.status === "PAID") return redirect("ok", intent.refId ?? "");
  const authority = String(req.query.Authority ?? intent.authority ?? "");
  if (String(req.query.Status) !== "OK") {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "CANCELLED", error: "انصراف کاربر" } });
    return redirect("cancelled");
  }
  const c = await cfg();
  const v = await zpVerify({ merchantId: c.merchantId, sandbox: c.sandbox }, { amount: intent.amount, authority });
  if (!v.ok) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED", error: v.error } });
    return redirect("failed");
  }
  await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "PAID", refId: v.refId, paidAt: new Date(), authority } });
  if (intent.purpose === "WALLET") {
    await prisma.walletTransaction.create({ data: { patientId: intent.patientId, amount: intent.amount, type: "DEPOSIT", description: `شارژ آنلاین - کد پیگیری ${v.refId}` } });
  } else {
    let invoiceId = intent.invoiceId;
    if (!invoiceId) invoiceId = (await prisma.invoice.findFirst({ where: { patientId: intent.patientId, status: { in: ["ISSUED", "PARTIAL"] } }, orderBy: { date: "asc" } }))?.id ?? null;
    await prisma.payment.create({ data: { patientId: intent.patientId, invoiceId, amount: intent.amount, method: "ONLINE", reference: v.refId ?? null, note: "پرداخت آنلاین زرین‌پال" } });
    if (invoiceId) await recomputeInvoice(invoiceId);
  }
  await notifyUser(intent.patient.userId, "پرداخت آنلاین موفق", `مبلغ ${formatMoney(intent.amount)} ثبت شد. کد پیگیری: ${v.refId}`, "/panel/my/finance");
  await notifyRole("SECRETARY", "پرداخت آنلاین جدید", `${intent.patient.firstName} ${intent.patient.lastName}: ${formatMoney(intent.amount)}`, `/panel/patients/${intent.patientId}?tab=finance`);
  await audit(null, "online-payment", "payment", intent.id, { amount: intent.amount, refId: v.refId });
  return redirect("ok", v.refId ?? "");
});

paymentsRouter.get("/intents", requireAuth, async (req, res) => {
  const where: any = {};
  if (req.user!.role === "PATIENT") where.patientId = req.user!.patientId;
  else if (req.query.patientId) where.patientId = String(req.query.patientId);
  const items = await prisma.paymentIntent.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { patient: { select: { firstName: true, lastName: true, fileNumber: true } } } });
  res.json({ items });
});

/** ---------- اعلام پرداخت کارت‌به‌کارت (بیمار ثبت می‌کند، منشی تأیید) ---------- */
paymentsRouter.post("/claim", requireAuth, async (req, res) => {
  const body = validate(z.object({ patientId: zOptionalString, amount: zInt.refine((v) => v > 0, "مبلغ نامعتبر است"), reference: zOptionalString, note: zOptionalString, purpose: z.enum(["INVOICE", "WALLET"]).default("INVOICE") }), req.body);
  const patientId = req.user!.role === "PATIENT" ? req.user!.patientId! : body.patientId;
  if (!patientId || !canAccessPatient(req, patientId)) throw forbidden();
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw notFound();
  const claim = await prisma.paymentIntent.create({ data: { patientId, amount: body.amount, purpose: body.purpose, provider: "manual", refId: body.reference ?? null, note: body.note ?? null, status: "PENDING" } });
  const msg = `${patient.firstName} ${patient.lastName}: ${formatMoney(body.amount)}${body.reference ? ` (پیگیری ${body.reference})` : ""}`;
  await notifyRole("SECRETARY", "اعلام پرداخت کارت‌به‌کارت", msg, `/panel/patients/${patientId}?tab=finance`);
  await notifyRole("ADMIN", "اعلام پرداخت کارت‌به‌کارت", msg, `/panel/patients/${patientId}?tab=finance`);
  res.status(201).json({ claim });
});

paymentsRouter.get("/claims", requireAuth, requireAdminOrSecretary, async (req, res) => {
  const where: any = { provider: "manual" };
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  const items = await prisma.paymentIntent.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true, phone: true } } } });
  const pending = await prisma.paymentIntent.count({ where: { provider: "manual", status: "PENDING" } });
  res.json({ items, pending });
});

paymentsRouter.post("/claims/:id/approve", requireAuth, requireAdminOrSecretary, async (req, res) => {
  const c = await prisma.paymentIntent.findUnique({ where: { id: String(req.params.id) }, include: { patient: true } });
  if (!c || c.provider !== "manual" || c.status !== "PENDING") throw notFound("اعلام پرداخت یافت نشد یا قبلاً بررسی شده");
  const body = validate(z.object({ amount: zOptionalInt }), req.body ?? {});
  const amount = body.amount ?? c.amount;
  if (c.purpose === "WALLET") {
    await prisma.walletTransaction.create({ data: { patientId: c.patientId, amount, type: "DEPOSIT", description: `کارت‌به‌کارت${c.refId ? ` - پیگیری ${c.refId}` : ""}`, createdById: req.user!.id } });
  } else {
    const inv = await prisma.invoice.findFirst({ where: { patientId: c.patientId, status: { in: ["ISSUED", "PARTIAL"] } }, orderBy: { date: "asc" } });
    await prisma.payment.create({ data: { patientId: c.patientId, invoiceId: inv?.id ?? null, amount, method: "TRANSFER", reference: c.refId ?? null, note: c.note ?? "اعلام پرداخت بیمار", receivedById: req.user!.id } });
    if (inv) await recomputeInvoice(inv.id);
  }
  await prisma.paymentIntent.update({ where: { id: c.id }, data: { status: "PAID", amount, paidAt: new Date(), handledById: req.user!.id } });
  await notifyUser(c.patient.userId, "پرداخت شما تأیید شد", `مبلغ ${formatMoney(amount)} در حساب شما ثبت شد`, "/panel/my/finance");
  await audit(req.user!.id, "approve-claim", "payment", c.id, { amount });
  res.json({ ok: true, summary: await patientFinancialSummary(c.patientId) });
});

paymentsRouter.post("/claims/:id/reject", requireAuth, requireAdminOrSecretary, async (req, res) => {
  const c = await prisma.paymentIntent.findUnique({ where: { id: String(req.params.id) }, include: { patient: true } });
  if (!c || c.provider !== "manual" || c.status !== "PENDING") throw notFound();
  const body = validate(z.object({ reason: zOptionalString }), req.body ?? {});
  await prisma.paymentIntent.update({ where: { id: c.id }, data: { status: "FAILED", error: body.reason ?? "تأیید نشد", handledById: req.user!.id } });
  await notifyUser(c.patient.userId, "اعلام پرداخت تأیید نشد", body.reason ?? "لطفاً با پذیرش تماس بگیرید", "/panel/my/finance");
  res.json({ ok: true });
});

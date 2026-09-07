import { Router } from "express";
import { z } from "zod";
import { formatMoney } from "@toranj/shared";
import { prisma } from "../lib/prisma.js";
import { validate, zInt, zOptionalString } from "../lib/validate.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { getSetting, getSettingBool, getSettingNumber } from "../lib/settings.js";
import { requireAuth, canAccessPatient } from "../middleware/auth.js";
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

import { Router } from "express";
import { z } from "zod";
import { PAYMENT_METHODS, WALLET_TX_TYPES, formatMoney, formatJalaliLong, startOfDay, endOfDay } from "@toranj/shared";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zDate, zOptionalDate, zOptionalString, zInt, zOptionalInt } from "../lib/validate.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { requireAuth, requireStaff, requireAdminOrSecretary, requireRole, canAccessPatient } from "../middleware/auth.js";
import { nextNumber } from "../lib/numbering.js";
import { patientFinancialSummary, recomputeInvoice, patientDebtItems, checkDebtAlert } from "../lib/finance.js";
import { getSetting, getSettingBool, getSettingNumber } from "../lib/settings.js";
import { sendTemplateSms } from "../lib/sms/service.js";
import { notifyUser } from "../lib/notify.js";
import { audit } from "../lib/audit.js";

export const financeRouter = Router();
financeRouter.use(requireAuth);

const patientSel = { patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true, phone: true, userId: true } } } as const;

/** پیامک صدور صورت‌حساب (اختیاری از تنظیمات) */
async function smsInvoiceIssued(inv: { number: string; total: number; dueDate: Date | null; patient: { firstName: string; lastName: string; phone: string; id: string } }) {
  if (!(await getSettingBool("sms.autoInvoice", false)) || inv.total <= 0) return;
  const currency = await getSetting("finance.currency", "تومان");
  await sendTemplateSms("invoice_issued", inv.patient.phone, { name: `${inv.patient.firstName} ${inv.patient.lastName}`, number: inv.number, amount: formatMoney(inv.total, ""), currency, due: inv.dueDate ? formatJalaliLong(inv.dueDate) : "-" }, { related: { type: "patient", id: inv.patient.id } });
}
const withName = (r: any) => ({ ...r, patientName: r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : null });

/** پروفایل مالی کامل یک مراجع: خلاصه، صورت‌حساب‌ها، پرداخت‌ها، کیف پول، تخفیف‌ها */
financeRouter.get("/patients/:patientId", async (req, res) => {
  const patientId = String(req.params.patientId);
  if (!canAccessPatient(req, patientId)) throw forbidden();
  const [summary, debts, invoices, payments, walletTxs, discounts] = await Promise.all([
    patientFinancialSummary(patientId),
    patientDebtItems(patientId),
    prisma.invoice.findMany({ where: { patientId }, orderBy: { date: "desc" }, include: { payments: true } }),
    prisma.payment.findMany({ where: { patientId }, orderBy: { date: "desc" }, include: { invoice: { select: { number: true } }, receivedBy: { select: { firstName: true, lastName: true } } } }),
    prisma.walletTransaction.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    prisma.discount.findMany({ where: { OR: [{ patientId }, { patientId: null }], isActive: true }, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({
    summary,
    currency: await getSetting("finance.currency", "تومان"),
    debts,
    debtAlertThreshold: await getSettingNumber("finance.debtAlertThreshold", 6000000),
    invoices: invoices.map((i) => ({ ...i, items: parseJson(i.items, []) })),
    payments,
    walletTxs,
    discounts,
  });
});

/** صورت‌حساب (statement) ترکیبی و زمان‌بندی‌شده برای چاپ */
financeRouter.get("/patients/:patientId/statement", async (req, res) => {
  const patientId = String(req.params.patientId);
  if (!canAccessPatient(req, patientId)) throw forbidden();
  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({ where: { patientId, status: { notIn: ["CANCELLED", "DRAFT"] } }, orderBy: { date: "asc" } }),
    prisma.payment.findMany({ where: { patientId }, orderBy: { date: "asc" } }),
  ]);
  const lines = [
    ...invoices.map((i) => ({ date: i.date, type: "invoice" as const, ref: i.number, description: i.kind === "DEBT" ? `بدهی: ${parseJson<{ title: string }[]>(i.items, [])[0]?.title ?? ""}` : `صورت‌حساب ${i.number}`, debit: i.total, credit: 0 })),
    ...payments.map((p) => ({ date: p.date, type: "payment" as const, ref: p.reference ?? "", description: `پرداخت (${p.method})`, debit: 0, credit: p.amount })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = 0;
  const out = lines.map((l) => {
    running += l.debit - l.credit;
    return { ...l, balance: running };
  });
  res.json({ lines: out, balance: running, summary: await patientFinancialSummary(patientId) });
});

// ---------- صورت‌حساب ----------
const invoiceItem = z.object({ title: z.string().min(1), qty: zInt.default(1), unitPrice: zInt });
const invoiceSchema = z.object({
  patientId: z.string().min(1),
  date: zDate.optional(),
  dueDate: zOptionalDate.optional(),
  items: z.array(invoiceItem).min(1, "حداقل یک ردیف لازم است"),
  discount: zOptionalInt,
  discountNote: zOptionalString,
  notes: zOptionalString,
  appointmentIds: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "ISSUED"]).optional(),
});

financeRouter.get("/invoices", requireStaff, async (req, res) => {
  const where: any = {};
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = startOfDay(new Date(String(req.query.from)));
    if (req.query.to) where.date.lte = endOfDay(new Date(String(req.query.to)));
  }
  const q = String(req.query.q ?? "").trim();
  if (q) where.OR = [{ number: { contains: q } }, { patient: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { fileNumber: { contains: q } }] } }];
  const items = await prisma.invoice.findMany({ where, include: patientSel, orderBy: { date: "desc" }, take: 500 });
  res.json({ items: items.map((i) => withName({ ...i, items: parseJson(i.items, []) })) });
});

financeRouter.post("/invoices", requireAdminOrSecretary, async (req, res) => {
  const body = validate(invoiceSchema, req.body);
  const subtotal = body.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const discount = Math.min(subtotal, Math.max(0, body.discount ?? 0));
  const dueDays = await getSettingNumber("finance.dueDays", 7);
  const date = body.date ?? new Date();
  const inv = await prisma.invoice.create({
    data: {
      number: await nextNumber("invoice", "INV-"),
      patientId: body.patientId,
      date,
      dueDate: body.dueDate ?? new Date(date.getTime() + dueDays * 86400000),
      items: JSON.stringify(body.items),
      subtotal,
      discount,
      discountNote: body.discountNote ?? null,
      total: subtotal - discount,
      notes: body.notes ?? null,
      status: body.status ?? "ISSUED",
    },
    include: patientSel,
  });
  if (body.appointmentIds?.length) await prisma.appointment.updateMany({ where: { id: { in: body.appointmentIds } }, data: { invoiceId: inv.id } });
  await notifyUser(inv.patient.userId, "صورت‌حساب جدید", `صورت‌حساب ${inv.number} به مبلغ ${formatMoney(inv.total)} صادر شد`, "/panel/my/finance");
  smsInvoiceIssued(inv).catch(console.error);
  await checkDebtAlert(inv.patientId);
  await audit(req.user!.id, "create", "invoice", inv.id);
  res.status(201).json({ invoice: withName({ ...inv, items: body.items }) });
});

/** ساخت سریع صورت‌حساب از جلسات انجام‌شده و فاکتورنشده یک مراجع */
financeRouter.post("/invoices/from-sessions", requireAdminOrSecretary, async (req, res) => {
  const body = validate(z.object({ patientId: z.string().min(1), discount: zOptionalInt, discountNote: zOptionalString }), req.body);
  const sessions = await prisma.appointment.findMany({ where: { patientId: body.patientId, status: "DONE", invoiceId: null }, include: { therapist: { include: { user: true } } }, orderBy: { startAt: "asc" } });
  if (!sessions.length) throw badRequest("جلسه انجام‌شده‌ی فاکتورنشده‌ای وجود ندارد");
  const defaultPrice = await getSettingNumber("schedule.defaultSessionPrice", 0);
  const items = sessions.map((s) => ({ title: `جلسه توان‌بخشی - ${s.therapist.user.firstName} ${s.therapist.user.lastName}`, qty: 1, unitPrice: s.price ?? defaultPrice }));
  const subtotal = items.reduce((a, i) => a + i.unitPrice, 0);
  const discount = Math.min(subtotal, Math.max(0, body.discount ?? 0));
  const dueDays = await getSettingNumber("finance.dueDays", 7);
  const inv = await prisma.invoice.create({
    data: { number: await nextNumber("invoice", "INV-"), patientId: body.patientId, dueDate: new Date(Date.now() + dueDays * 86400000), items: JSON.stringify(items), subtotal, discount, discountNote: body.discountNote ?? null, total: subtotal - discount },
    include: patientSel,
  });
  await prisma.appointment.updateMany({ where: { id: { in: sessions.map((s) => s.id) } }, data: { invoiceId: inv.id } });
  smsInvoiceIssued(inv).catch(console.error);
  await checkDebtAlert(inv.patientId);
  res.status(201).json({ invoice: withName({ ...inv, items }) });
});

financeRouter.get("/invoices/:id", async (req, res) => {
  const inv = await prisma.invoice.findUnique({ where: { id: String(req.params.id) }, include: { ...patientSel, payments: true, appointments: true } });
  if (!inv || !canAccessPatient(req, inv.patientId)) throw notFound("صورت‌حساب یافت نشد");
  res.json({ invoice: withName({ ...inv, items: parseJson(inv.items, []) }), clinic: { name: await getSetting("clinic.name"), address: await getSetting("clinic.address"), phone: await getSetting("clinic.phone") } });
});

financeRouter.patch("/invoices/:id", requireAdminOrSecretary, async (req, res) => {
  const body = validate(invoiceSchema.partial().extend({ status: z.enum(["DRAFT", "ISSUED", "CANCELLED"]).optional() }), req.body);
  const cur = await prisma.invoice.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound();
  const items = body.items ?? parseJson<any[]>(cur.items, []);
  const subtotal = items.reduce((s: number, it: any) => s + it.qty * it.unitPrice, 0);
  const discount = Math.min(subtotal, Math.max(0, body.discount ?? cur.discount));
  const inv = await prisma.invoice.update({
    where: { id: cur.id },
    data: { items: JSON.stringify(items), subtotal, discount, total: subtotal - discount, discountNote: body.discountNote ?? cur.discountNote, notes: body.notes ?? cur.notes, dueDate: body.dueDate === undefined ? cur.dueDate : body.dueDate, status: body.status ?? cur.status },
    include: patientSel,
  });
  await recomputeInvoice(inv.id);
  await checkDebtAlert(inv.patientId);
  res.json({ invoice: withName({ ...inv, items }) });
});

// ---------- پرداخت ----------
const paymentSchema = z.object({
  patientId: z.string().min(1),
  invoiceId: zOptionalString,
  amount: zInt.refine((v) => v > 0, "مبلغ باید بزرگ‌تر از صفر باشد"),
  method: z.enum(PAYMENT_METHODS).optional(),
  reference: zOptionalString,
  note: zOptionalString,
  date: zDate.optional(),
  sendSms: z.boolean().optional(),
});

financeRouter.get("/payments", requireStaff, async (req, res) => {
  const where: any = {};
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  if (req.query.method) where.method = String(req.query.method);
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = startOfDay(new Date(String(req.query.from)));
    if (req.query.to) where.date.lte = endOfDay(new Date(String(req.query.to)));
  }
  const items = await prisma.payment.findMany({ where, include: { ...patientSel, invoice: { select: { number: true } }, receivedBy: { select: { firstName: true, lastName: true } } }, orderBy: { date: "desc" }, take: 500 });
  const sum = items.reduce((s, p) => s + p.amount, 0);
  res.json({ items: items.map(withName), sum });
});

financeRouter.post("/payments", requireAdminOrSecretary, async (req, res) => {
  const body = validate(paymentSchema, req.body);
  const method = body.method ?? "CASH";
  if (method === "WALLET") {
    const wallet = await prisma.walletTransaction.aggregate({ where: { patientId: body.patientId }, _sum: { amount: true } });
    if ((wallet._sum.amount ?? 0) < body.amount) throw badRequest(`موجودی کیف پول کافی نیست (${formatMoney(wallet._sum.amount ?? 0)})`);
  }
  // اگر صورت‌حساب مشخص نشده، به قدیمی‌ترین صورت‌حساب باز اختصاص می‌دهیم
  let invoiceId = body.invoiceId ?? null;
  if (!invoiceId) {
    const open = await prisma.invoice.findFirst({ where: { patientId: body.patientId, status: { in: ["ISSUED", "PARTIAL"] } }, orderBy: { date: "asc" } });
    invoiceId = open?.id ?? null;
  }
  const p = await prisma.payment.create({
    data: { patientId: body.patientId, invoiceId, amount: body.amount, method, reference: body.reference ?? null, note: body.note ?? null, date: body.date ?? new Date(), receivedById: req.user!.id },
    include: patientSel,
  });
  if (method === "WALLET") {
    await prisma.walletTransaction.create({ data: { patientId: body.patientId, amount: -body.amount, type: "CHARGE", description: `پرداخت صورت‌حساب${invoiceId ? "" : " (بدون صورت‌حساب)"}`, createdById: req.user!.id } });
  }
  if (invoiceId) await recomputeInvoice(invoiceId);
  await checkDebtAlert(body.patientId);
  const summary = await patientFinancialSummary(body.patientId);
  const currency = await getSetting("finance.currency", "تومان");
  if (body.sendSms) {
    sendTemplateSms("payment_received", p.patient.phone, { name: `${p.patient.firstName} ${p.patient.lastName}`, amount: formatMoney(body.amount, ""), currency, balance: formatMoney(Math.max(0, summary.balance), "") }, { related: { type: "patient", id: p.patientId } }).catch(console.error);
  }
  await notifyUser(p.patient.userId, "پرداخت ثبت شد", `مبلغ ${formatMoney(body.amount, currency)} در حساب شما ثبت شد`, "/panel/my/finance");
  await audit(req.user!.id, "create", "payment", p.id, { amount: body.amount, method });
  res.status(201).json({ payment: withName(p), summary });
});

/** ویرایش پرداخت (اشتباه در روش/مبلغ/تاریخ) */
financeRouter.patch("/payments/:id", requireAdminOrSecretary, async (req, res) => {
  const body = validate(z.object({ amount: zInt.refine((v) => v > 0, "مبلغ باید بزرگ‌تر از صفر باشد").optional(), method: z.enum(PAYMENT_METHODS).optional(), reference: zOptionalString, note: zOptionalString, date: zDate.optional() }), req.body);
  const cur = await prisma.payment.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound("پرداخت یافت نشد");
  if (cur.method === "WALLET" || body.method === "WALLET") throw badRequest("پرداخت از کیف پول قابل ویرایش نیست؛ حذف و دوباره ثبت کنید");
  const p = await prisma.payment.update({ where: { id: cur.id }, data: { amount: body.amount ?? cur.amount, method: body.method ?? cur.method, reference: body.reference === undefined ? cur.reference : body.reference, note: body.note === undefined ? cur.note : body.note, date: body.date ?? cur.date }, include: patientSel });
  if (p.invoiceId) await recomputeInvoice(p.invoiceId);
  await checkDebtAlert(p.patientId);
  await audit(req.user!.id, "update", "payment", p.id, body);
  res.json({ payment: withName(p), summary: await patientFinancialSummary(p.patientId) });
});

financeRouter.delete("/payments/:id", requireRole("ADMIN"), async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: String(req.params.id) } });
  if (!p) throw notFound();
  await prisma.payment.delete({ where: { id: p.id } });
  if (p.method === "WALLET") await prisma.walletTransaction.create({ data: { patientId: p.patientId, amount: p.amount, type: "REFUND", description: "حذف پرداخت از کیف پول", createdById: req.user!.id } });
  if (p.invoiceId) await recomputeInvoice(p.invoiceId);
  await checkDebtAlert(p.patientId);
  await audit(req.user!.id, "delete", "payment", p.id);
  res.json({ ok: true });
});

// ---------- کیف پول ----------
financeRouter.post("/wallet", requireAdminOrSecretary, async (req, res) => {
  const body = validate(z.object({ patientId: z.string().min(1), amount: zInt.refine((v) => v !== 0, "مبلغ نمی‌تواند صفر باشد"), type: z.enum(WALLET_TX_TYPES), description: zOptionalString }), req.body);
  const signed = ["WITHDRAW", "CHARGE"].includes(body.type) ? -Math.abs(body.amount) : ["DEPOSIT", "REFUND", "GIFT"].includes(body.type) ? Math.abs(body.amount) : body.amount;
  const tx = await prisma.walletTransaction.create({ data: { patientId: body.patientId, amount: signed, type: body.type, description: body.description ?? null, createdById: req.user!.id } });
  const summary = await patientFinancialSummary(body.patientId);
  await audit(req.user!.id, "wallet", "patient", body.patientId, { amount: signed, type: body.type });
  res.status(201).json({ tx, summary });
});

// ---------- تخفیف ----------
financeRouter.get("/discounts", requireStaff, async (req, res) => {
  const where: any = {};
  if (req.query.patientId) where.OR = [{ patientId: String(req.query.patientId) }, { patientId: null }];
  const items = await prisma.discount.findMany({ where, include: { patient: { select: { firstName: true, lastName: true, fileNumber: true } } }, orderBy: { createdAt: "desc" } });
  res.json({ items });
});
financeRouter.post("/discounts", requireAdminOrSecretary, async (req, res) => {
  const body = validate(z.object({ patientId: zOptionalString, title: z.string().min(1), percent: zOptionalInt, amount: zOptionalInt, reason: zOptionalString, validFrom: zOptionalDate.optional(), validTo: zOptionalDate.optional() }), req.body);
  const d = await prisma.discount.create({ data: { ...body, patientId: body.patientId ?? null, validFrom: body.validFrom ?? null, validTo: body.validTo ?? null } });
  res.status(201).json({ discount: d });
});
financeRouter.patch("/discounts/:id", requireAdminOrSecretary, async (req, res) => {
  const body = validate(z.object({ isActive: z.boolean().optional(), title: z.string().optional(), percent: zOptionalInt, amount: zOptionalInt, reason: zOptionalString }), req.body);
  const d = await prisma.discount.update({ where: { id: String(req.params.id) }, data: body });
  res.json({ discount: d });
});

/** یادآوری بدهی با پیامک */
financeRouter.post("/patients/:patientId/debt-reminder", requireAdminOrSecretary, async (req, res) => {
  const p = await prisma.patient.findUnique({ where: { id: String(req.params.patientId) } });
  if (!p) throw notFound();
  const summary = await patientFinancialSummary(p.id);
  if (summary.balance <= 0) throw badRequest("این مراجع بدهی ندارد");
  const log = await sendTemplateSms("debt_reminder", p.phone, { name: `${p.firstName} ${p.lastName}`, balance: formatMoney(summary.balance, ""), currency: await getSetting("finance.currency", "تومان") }, { related: { type: "patient", id: p.id } });
  res.json({ log });
});

// ---------- بدهی دستی (مبلغ دلخواه) ----------
const debtSchema = z.object({
  amount: zInt.refine((v) => v > 0, "مبلغ بدهی باید بزرگ‌تر از صفر باشد"),
  title: z.string().trim().min(1, "بابت چه چیزی؟ شرح بدهی را بنویسید").max(200),
  date: zDate.optional(),
  note: zOptionalString,
});

/** ثبت بدهی با مبلغ دلخواه برای مراجع (مثلاً بدهی قبلی، جلسه‌ای که پرداخت نشده، هزینه وسیله) */
financeRouter.post("/patients/:patientId/debts", requireAdminOrSecretary, async (req, res) => {
  const body = validate(debtSchema, req.body);
  const patient = await prisma.patient.findUnique({ where: { id: String(req.params.patientId) }, select: { id: true } });
  if (!patient) throw notFound("مراجع یافت نشد");
  const date = body.date ?? new Date();
  const inv = await prisma.invoice.create({
    data: { number: await nextNumber("debt", "DBT-"), kind: "DEBT", patientId: patient.id, date, dueDate: date, items: JSON.stringify([{ title: body.title, qty: 1, unitPrice: body.amount }]), subtotal: body.amount, discount: 0, total: body.amount, notes: body.note ?? null, status: "ISSUED" },
  });
  // اگر مراجع پیش‌پرداخت/بستانکاری داشته باشد، در محاسبه مانده خودکار لحاظ می‌شود
  await checkDebtAlert(patient.id);
  await audit(req.user!.id, "create", "debt", inv.id, { amount: body.amount, title: body.title });
  res.status(201).json({ debt: inv, summary: await patientFinancialSummary(patient.id) });
});

financeRouter.patch("/debts/:id", requireAdminOrSecretary, async (req, res) => {
  const body = validate(debtSchema.partial(), req.body);
  const cur = await prisma.invoice.findUnique({ where: { id: String(req.params.id) } });
  if (!cur || cur.kind !== "DEBT" || cur.status === "CANCELLED") throw notFound("بدهی یافت نشد");
  const amount = body.amount ?? cur.total;
  if (amount < cur.paid) throw badRequest(`مبلغ بدهی نمی‌تواند کمتر از مبلغ پرداخت‌شده آن (${formatMoney(cur.paid)}) باشد`);
  const title = body.title ?? parseJson<{ title: string }[]>(cur.items, [])[0]?.title ?? "بدهی";
  await prisma.invoice.update({ where: { id: cur.id }, data: { items: JSON.stringify([{ title, qty: 1, unitPrice: amount }]), subtotal: amount, total: amount, notes: body.note === undefined ? cur.notes : body.note, ...(body.date ? { date: body.date, dueDate: body.date } : {}) } });
  await recomputeInvoice(cur.id);
  await checkDebtAlert(cur.patientId);
  await audit(req.user!.id, "update", "debt", cur.id, body);
  res.json({ ok: true, summary: await patientFinancialSummary(cur.patientId) });
});

/** حذف بدهی دستی (فقط اگر پرداختی به آن وصل نباشد) */
financeRouter.delete("/debts/:id", requireAdminOrSecretary, async (req, res) => {
  const cur = await prisma.invoice.findUnique({ where: { id: String(req.params.id) }, include: { _count: { select: { payments: true } } } });
  if (!cur || cur.kind !== "DEBT" || cur.status === "CANCELLED") throw notFound("بدهی یافت نشد");
  if (cur._count.payments > 0) throw badRequest("برای این بدهی پرداخت ثبت شده؛ اول آن پرداخت را حذف کنید یا مبلغ بدهی را ویرایش کنید");
  await prisma.invoice.update({ where: { id: cur.id }, data: { status: "CANCELLED" } });
  await checkDebtAlert(cur.patientId);
  await audit(req.user!.id, "delete", "debt", cur.id, { amount: cur.total });
  res.json({ ok: true, summary: await patientFinancialSummary(cur.patientId) });
});

/** گزارش مالی کلی (داشبورد مدیریت) */
financeRouter.get("/report", requireRole("ADMIN", "SECRETARY"), async (req, res) => {
  const from = req.query.from ? startOfDay(new Date(String(req.query.from))) : new Date(Date.now() - 30 * 86400000);
  const to = req.query.to ? endOfDay(new Date(String(req.query.to))) : new Date();
  const [payments, invoices, debtors] = await Promise.all([
    prisma.payment.findMany({ where: { date: { gte: from, lte: to } }, select: { amount: true, method: true, date: true } }),
    prisma.invoice.findMany({ where: { date: { gte: from, lte: to }, status: { notIn: ["CANCELLED", "DRAFT"] } }, select: { total: true, discount: true, paid: true, date: true } }),
    prisma.invoice.groupBy({ by: ["patientId"], where: { status: { in: ["ISSUED", "PARTIAL"] } }, _sum: { total: true, paid: true } }),
  ]);
  const byDay = new Map<string, { income: number; invoiced: number }>();
  const key = (d: Date) => d.toISOString().slice(0, 10);
  for (const p of payments) {
    const k = key(p.date);
    const v = byDay.get(k) ?? { income: 0, invoiced: 0 };
    v.income += p.amount;
    byDay.set(k, v);
  }
  for (const i of invoices) {
    const k = key(i.date);
    const v = byDay.get(k) ?? { income: 0, invoiced: 0 };
    v.invoiced += i.total;
    byDay.set(k, v);
  }
  const byMethod: Record<string, number> = {};
  for (const p of payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  const totalDebt = debtors.reduce((s, d) => s + ((d._sum.total ?? 0) - (d._sum.paid ?? 0)), 0);
  res.json({
    totalIncome: payments.reduce((s, p) => s + p.amount, 0),
    totalInvoiced: invoices.reduce((s, i) => s + i.total, 0),
    totalDiscount: invoices.reduce((s, i) => s + i.discount, 0),
    totalDebt,
    debtorsCount: debtors.filter((d) => (d._sum.total ?? 0) - (d._sum.paid ?? 0) > 0).length,
    byMethod,
    series: [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, v]) => ({ date, ...v })),
  });
});

/* ───────────── تسویه از روی نوبت و صورت مالی روزانه (پایان کار) ───────────── */

/** قیمت مؤثر یک نوبت: قیمت ثبت‌شده روی نوبت، وگرنه قیمت درمانگر، وگرنه پیش‌فرض تنظیمات */
async function effectivePrice(a: { price: number | null; therapist: { sessionPrice: number | null } }) {
  return a.price ?? a.therapist.sessionPrice ?? (await getSettingNumber("schedule.defaultSessionPrice", 0));
}

const settleInclude = { patient: patientSel.patient, therapist: { select: { id: true, sessionPrice: true, user: { select: { firstName: true, lastName: true } } } }, invoice: { select: { id: true, number: true, total: true, paid: true, status: true } } } as const;

/** پیش‌نمایش تسویه: مبلغ این جلسه، بدهی قبلی و جمع قابل پرداخت */
financeRouter.get("/settle-preview/:appointmentId", requireAdminOrSecretary, async (req, res) => {
  const a = await prisma.appointment.findUnique({ where: { id: String(req.params.appointmentId) }, include: settleInclude });
  if (!a) throw notFound("نوبت یافت نشد");
  const sessionPrice = await effectivePrice(a);
  const summary = await patientFinancialSummary(a.patientId);
  const alreadyInvoiced = !!a.invoiceId && a.invoice?.status !== "CANCELLED";
  // اگر این جلسه هنوز صورت‌حساب نشده، بدهی فعلی «بدهی قبلی» است و مبلغ جلسه به آن اضافه می‌شود
  const thisInvoiceDue = alreadyInvoiced ? Math.max(0, (a.invoice?.total ?? 0) - (a.invoice?.paid ?? 0)) : 0;
  const previousBalance = alreadyInvoiced ? summary.balance - thisInvoiceDue : summary.balance;
  const totalDue = Math.max(0, (alreadyInvoiced ? summary.balance : summary.balance + sessionPrice));
  res.json({
    appointment: { id: a.id, startAt: a.startAt, status: a.status, patientId: a.patientId, patientName: `${a.patient.firstName} ${a.patient.lastName}`, fileNumber: a.patient.fileNumber, therapistName: `${a.therapist.user.firstName} ${a.therapist.user.lastName}` },
    sessionPrice,
    therapistAmount: a.therapistAmount ?? sessionPrice,
    kind: a.kind,
    alreadyInvoiced,
    invoice: a.invoice,
    previousBalance,
    walletBalance: summary.walletBalance,
    totalDue,
  });
});

/**
 * تسویه یک نوبت: جلسه انجام‌شده علامت می‌خورد، اگر صورت‌حساب ندارد ساخته می‌شود،
 * و پرداخت (کامل یا مبلغ دلخواه) به قدیمی‌ترین صورت‌حساب‌های باز تخصیص می‌یابد.
 */
financeRouter.post("/settle-appointment", requireAdminOrSecretary, async (req, res) => {
  const body = validate(z.object({
    appointmentId: z.string().min(1),
    method: z.enum(["CASH", "CARD", "TRANSFER"]),
    full: z.boolean().optional(),
    amount: zOptionalInt,
    reference: zOptionalString,
    note: zOptionalString,
    sendSms: z.boolean().optional(),
    therapistAmount: zOptionalInt,
    noPayment: z.boolean().optional(), // مراجع این جلسه پرداخت نکرد: کل مبلغ به بدهی او اضافه می‌شود
  }), req.body);
  const a = await prisma.appointment.findUnique({ where: { id: body.appointmentId }, include: settleInclude });
  if (!a) throw notFound("نوبت یافت نشد");
  if (a.status === "CANCELLED") throw badRequest("نوبت لغوشده قابل تسویه نیست");
  const sessionPrice = await effectivePrice(a);
  const therapistName = `${a.therapist.user.firstName} ${a.therapist.user.lastName}`;

  await prisma.appointment.update({ where: { id: a.id }, data: { status: "DONE", price: a.price ?? sessionPrice, therapistAmount: body.therapistAmount ?? a.therapistAmount ?? null } });
  let invoiceId = a.invoiceId && a.invoice?.status !== "CANCELLED" ? a.invoiceId : null;
  if (!invoiceId && sessionPrice > 0) {
    const items = [{ title: `جلسه توان‌بخشی - ${therapistName}`, qty: 1, unitPrice: sessionPrice }];
    const inv = await prisma.invoice.create({ data: { number: await nextNumber("invoice", "INV-"), kind: "SESSION", patientId: a.patientId, dueDate: new Date(), items: JSON.stringify(items), subtotal: sessionPrice, discount: 0, total: sessionPrice } });
    await prisma.appointment.update({ where: { id: a.id }, data: { invoiceId: inv.id } });
    invoiceId = inv.id;
  }

  const before = await patientFinancialSummary(a.patientId);
  const amount = body.noPayment ? 0 : body.full ? Math.max(0, before.balance) : (body.amount ?? 0);
  if (amount <= 0 && !body.full && !body.noPayment) throw badRequest("مبلغ را وارد کنید");
  const paymentIds: string[] = [];
  if (amount > 0) {
    let remaining = amount;
    const open = await prisma.invoice.findMany({ where: { patientId: a.patientId, status: { in: ["ISSUED", "PARTIAL"] } }, orderBy: { date: "asc" } });
    const note = body.note ?? `تسویه جلسه ${therapistName}`;
    for (const inv of open) {
      if (remaining <= 0) break;
      const due = Math.max(0, inv.total - inv.paid);
      if (due <= 0) continue;
      const pay = Math.min(due, remaining);
      const p = await prisma.payment.create({ data: { patientId: a.patientId, invoiceId: inv.id, amount: pay, method: body.method, reference: body.reference ?? null, note, receivedById: req.user!.id } });
      paymentIds.push(p.id);
      await recomputeInvoice(inv.id);
      remaining -= pay;
    }
    if (remaining > 0) {
      // مازاد پرداخت به‌عنوان بستانکاری (بدون صورت‌حساب) ثبت می‌شود
      const p = await prisma.payment.create({ data: { patientId: a.patientId, invoiceId: null, amount: remaining, method: body.method, reference: body.reference ?? null, note: `${note} (مازاد / پیش‌پرداخت)`, receivedById: req.user!.id } });
      paymentIds.push(p.id);
    }
  }
  await checkDebtAlert(a.patientId);
  const summary = await patientFinancialSummary(a.patientId);
  const currency = await getSetting("finance.currency", "تومان");
  if (amount > 0 && body.sendSms) {
    sendTemplateSms("payment_received", a.patient.phone, { name: `${a.patient.firstName} ${a.patient.lastName}`, amount: formatMoney(amount, ""), currency, balance: formatMoney(Math.max(0, summary.balance), "") }, { related: { type: "patient", id: a.patientId } }).catch(console.error);
  }
  if (amount > 0) await notifyUser(a.patient.userId, "پرداخت ثبت شد", `مبلغ ${formatMoney(amount, currency)} در حساب شما ثبت شد`, "/panel/my/finance");
  await audit(req.user!.id, "settle", "appointment", a.id, { amount, method: body.method, full: !!body.full, noPayment: !!body.noPayment, paymentIds });
  res.status(201).json({ ok: true, paid: amount, summary, invoiceId });
});

/** صورت مالی روزانه (پایان کار): دریافتی‌ها به تفکیک روش، جلسات روز و وضعیت تسویه هر کدام */
financeRouter.get("/daily", requireAdminOrSecretary, async (req, res) => {
  const day = req.query.date ? new Date(String(req.query.date)) : new Date();
  const from = startOfDay(day);
  const to = endOfDay(day);
  const defaultPrice = await getSettingNumber("schedule.defaultSessionPrice", 0);
  const [payments, appointments, invoices, walletDeposits, cashEntries] = await Promise.all([
    prisma.payment.findMany({ where: { date: { gte: from, lte: to } }, include: { ...patientSel, invoice: { select: { number: true } }, receivedBy: { select: { firstName: true, lastName: true } } }, orderBy: { date: "asc" } }),
    prisma.appointment.findMany({ where: { startAt: { gte: from, lte: to } }, include: settleInclude, orderBy: { startAt: "asc" } }),
    prisma.invoice.findMany({ where: { date: { gte: from, lte: to }, status: { notIn: ["CANCELLED", "DRAFT"] } }, select: { total: true, discount: true } }),
    prisma.walletTransaction.findMany({ where: { createdAt: { gte: from, lte: to }, amount: { gt: 0 }, type: { in: ["DEPOSIT", "GIFT", "ADJUST"] } }, include: patientSel, orderBy: { createdAt: "asc" } }),
    prisma.cashEntry.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: "asc" } }),
  ]);
  const byMethod: Record<string, number> = {};
  for (const p of payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  // تراکنش‌های متفرقه صندوق هم در تفکیک روش لحاظ می‌شوند (دریافت +، پرداخت −)
  for (const c of cashEntries) byMethod[c.method] = (byMethod[c.method] ?? 0) + (c.direction === "OUT" ? -c.amount : c.amount);
  const cashIn = cashEntries.filter((c) => c.direction === "IN").reduce((s, c) => s + c.amount, 0);
  const cashOut = cashEntries.filter((c) => c.direction === "OUT").reduce((s, c) => s + c.amount, 0);
  const therapistUsers = await prisma.therapist.findMany({ include: { user: { select: { firstName: true, lastName: true } } } });
  const tName = (id: string | null) => { const t = therapistUsers.find((x) => x.id === id); return t ? `${t.user.firstName} ${t.user.lastName}` : null; };
  const patientIds = [...new Set(appointments.map((a) => a.patientId))];
  const balances = new Map<string, number>();
  for (const id of patientIds) balances.set(id, (await patientFinancialSummary(id)).balance);
  const sessions = appointments.map((a) => {
    const price = a.price ?? a.therapist.sessionPrice ?? defaultPrice;
    const invoiced = !!a.invoiceId && a.invoice?.status !== "CANCELLED";
    const settled = a.status === "DONE" && (invoiced ? a.invoice!.status === "PAID" : price === 0);
    return {
      id: a.id, startAt: a.startAt, endAt: a.endAt, status: a.status, price, invoiced, settled, kind: a.kind, therapistAmount: a.therapistAmount ?? price, therapistId: a.therapistId,
      invoiceNumber: a.invoice?.number ?? null,
      patientId: a.patientId, patientName: `${a.patient.firstName} ${a.patient.lastName}`, fileNumber: a.patient.fileNumber, phone: a.patient.phone,
      therapistName: `${a.therapist.user.firstName} ${a.therapist.user.lastName}`,
      balance: balances.get(a.patientId) ?? 0,
    };
  });
  const done = sessions.filter((s) => s.status === "DONE");
  // تسویه روزانه به تفکیک درمانگر: تعداد مراجع، جلسات، کارکرد، وصول‌شده و معوق
  const byTherapist = [...new Set(sessions.map((x) => x.therapistId))].map((tid) => {
    const list = done.filter((x) => x.therapistId === tid);
    const karkard = list.reduce((s, x) => s + x.therapistAmount, 0);
    const collected = list.filter((x) => x.settled).reduce((s, x) => s + x.therapistAmount, 0);
    return { therapistId: tid, therapistName: tName(tid), cases: new Set(list.map((x) => x.patientId)).size, sessions: list.length, assessments: list.filter((x) => x.kind === "ASSESSMENT").length, karkard, collected, pending: karkard - collected, noShow: sessions.filter((x) => x.therapistId === tid && x.status === "NO_SHOW").length };
  });
  res.json({
    date: from,
    totals: {
      received: payments.reduce((s, p) => s + p.amount, 0) + cashIn - cashOut,
      patientPayments: payments.reduce((s, p) => s + p.amount, 0),
      cashIn, cashOut,
      karkard: done.reduce((s, x) => s + x.therapistAmount, 0),
      byMethod,
      walletDeposits: walletDeposits.reduce((s, w) => s + w.amount, 0),
      invoiced: invoices.reduce((s, i) => s + i.total, 0),
      discount: invoices.reduce((s, i) => s + i.discount, 0),
      expectedFromSessions: done.reduce((s, x) => s + x.price, 0),
      unsettledSessions: done.filter((s) => !s.settled).length,
      sessions: sessions.length,
      done: done.length,
      noShow: sessions.filter((s) => s.status === "NO_SHOW").length,
      cancelled: sessions.filter((s) => s.status === "CANCELLED").length,
      pending: sessions.filter((s) => s.status === "SCHEDULED" || s.status === "CONFIRMED").length,
    },
    payments: payments.map((p) => ({ ...withName(p), invoiceNumber: p.invoice?.number ?? null, receivedByName: p.receivedBy ? `${p.receivedBy.firstName} ${p.receivedBy.lastName}` : null })),
    walletDeposits: walletDeposits.map(withName),
    cashEntries: cashEntries.map((c) => ({ ...c, therapistName: tName(c.therapistId) })),
    byTherapist,
    sessions,
  });
});

/* ───────────── تراکنش‌های متفرقه صندوق ───────────── */
const cashSchema = z.object({ date: zDate.optional(), direction: z.enum(["IN", "OUT"]).default("IN"), amount: zInt.refine((v) => v > 0, "مبلغ باید بزرگ‌تر از صفر باشد"), method: z.enum(["CASH", "CARD", "TRANSFER"]).default("CARD"), reason: z.string().min(1, "دلیل را بنویسید"), note: zOptionalString, therapistId: zOptionalString, patientId: zOptionalString });

/** ثبت تراکنش: اگر به مراجع نسبت داده شود، به‌عنوان پرداخت در حساب او ثبت می‌شود (بستانکاری/تسویه) */
financeRouter.post("/cash", requireAdminOrSecretary, async (req, res) => {
  const body = validate(cashSchema, req.body);
  if (body.patientId) {
    if (body.direction === "OUT") throw badRequest("برای بازپرداخت به مراجع از پروفایل مالی او (کیف پول/بازپرداخت) استفاده کنید");
    const open = await prisma.invoice.findFirst({ where: { patientId: body.patientId, status: { in: ["ISSUED", "PARTIAL"] } }, orderBy: { date: "asc" } });
    const p = await prisma.payment.create({ data: { patientId: body.patientId, invoiceId: open?.id ?? null, amount: body.amount, method: body.method, note: body.reason + (body.note ? ` — ${body.note}` : ""), date: body.date ?? new Date(), receivedById: req.user!.id }, include: patientSel });
    if (open) await recomputeInvoice(open.id);
    await checkDebtAlert(body.patientId);
    await audit(req.user!.id, "create", "payment", p.id, { via: "cash", reason: body.reason });
    return res.status(201).json({ payment: withName(p), summary: await patientFinancialSummary(body.patientId) });
  }
  const c = await prisma.cashEntry.create({ data: { date: body.date ?? new Date(), direction: body.direction, amount: body.amount, method: body.method, reason: body.reason, note: body.note ?? null, therapistId: body.therapistId ?? null, createdById: req.user!.id } });
  await audit(req.user!.id, "create", "cash", c.id, body);
  res.status(201).json({ entry: c });
});

financeRouter.patch("/cash/:id", requireAdminOrSecretary, async (req, res) => {
  const body = validate(cashSchema.partial(), req.body);
  const c = await prisma.cashEntry.update({ where: { id: String(req.params.id) }, data: { ...body, patientId: undefined } as any });
  res.json({ entry: c });
});

financeRouter.delete("/cash/:id", requireAdminOrSecretary, async (req, res) => {
  await prisma.cashEntry.delete({ where: { id: String(req.params.id) } });
  await audit(req.user!.id, "delete", "cash", String(req.params.id));
  res.json({ ok: true });
});

/* ───────────── پروفایل مالی درمانگران (کارکرد و تسویه) ───────────── */
async function therapistStats(therapistId: string, from: Date, to: Date) {
  const defaultPrice = await getSettingNumber("schedule.defaultSessionPrice", 0);
  const rows = await prisma.appointment.findMany({ where: { therapistId, startAt: { gte: from, lte: to }, status: { in: ["DONE", "NO_SHOW"] } }, include: { patient: { select: { id: true, firstName: true, lastName: true, fileNumber: true } }, therapist: { select: { sessionPrice: true } }, invoice: { select: { status: true, number: true } } }, orderBy: { startAt: "asc" } });
  const items = rows.map((a) => { const price = a.price ?? a.therapist.sessionPrice ?? defaultPrice; const amount = a.therapistAmount ?? price; const settled = a.status === "DONE" && (a.invoice ? a.invoice.status === "PAID" : price === 0); return { id: a.id, startAt: a.startAt, status: a.status, kind: a.kind, patientId: a.patientId, patientName: `${a.patient.firstName} ${a.patient.lastName}`, fileNumber: a.patient.fileNumber, price, therapistAmount: amount, settled, invoiceNumber: a.invoice?.number ?? null }; });
  const done = items.filter((x) => x.status === "DONE");
  const byDay = new Map<string, { date: string; sessions: number; karkard: number; collected: number }>();
  for (const x of done) { const k = startOfDay(x.startAt).toISOString(); const v = byDay.get(k) ?? { date: k, sessions: 0, karkard: 0, collected: 0 }; v.sessions += 1; v.karkard += x.therapistAmount; if (x.settled) v.collected += x.therapistAmount; byDay.set(k, v); }
  const karkard = done.reduce((s, x) => s + x.therapistAmount, 0);
  const collected = done.filter((x) => x.settled).reduce((s, x) => s + x.therapistAmount, 0);
  // ریز کیس‌ها: هر مراجع با تعداد جلسات و مبلغ کارکرد درمانگر (مستقل از بدهی یا پرداخت مراجع)
  const byCase = new Map<string, { patientId: string; patientName: string; fileNumber: string; sessions: number; assessments: number; amount: number; lastAt: Date }>();
  for (const x of done) { const v = byCase.get(x.patientId) ?? { patientId: x.patientId, patientName: x.patientName, fileNumber: x.fileNumber, sessions: 0, assessments: 0, amount: 0, lastAt: x.startAt }; v.sessions += 1; if (x.kind === "ASSESSMENT") v.assessments += 1; v.amount += x.therapistAmount; if (x.startAt > v.lastAt) v.lastAt = x.startAt; byCase.set(x.patientId, v); }
  const activeCases = await prisma.patient.count({ where: { primaryTherapistId: therapistId, status: "ACTIVE" } });
  return { activeCases, caseList: [...byCase.values()].sort((a, b) => b.amount - a.amount), cases: new Set(done.map((x) => x.patientId)).size, sessions: done.length, assessments: done.filter((x) => x.kind === "ASSESSMENT").length, noShow: items.filter((x) => x.status === "NO_SHOW").length, karkard, collected, pending: karkard - collected, byDay: [...byDay.values()], items };
}

financeRouter.get("/therapists", requireStaff, async (req, res) => {
  const from = req.query.from ? startOfDay(new Date(String(req.query.from))) : startOfDay(new Date(Date.now() - 29 * 86400000));
  const to = req.query.to ? endOfDay(new Date(String(req.query.to))) : endOfDay(new Date());
  let therapists = await prisma.therapist.findMany({ include: { user: { select: { firstName: true, lastName: true, avatar: true, isActive: true } } }, orderBy: { sortOrder: "asc" } });
  if (req.user!.role === "THERAPIST") therapists = therapists.filter((t) => t.id === req.user!.therapistId);
  const items = [];
  for (const t of therapists) { const st = await therapistStats(t.id, from, to); items.push({ therapistId: t.id, fullName: `${t.user.firstName} ${t.user.lastName}`, avatar: t.user.avatar, color: t.color, isActive: t.user.isActive, ...st, items: undefined, caseList: undefined, byDay: undefined }); }
  res.json({ from, to, items });
});

financeRouter.get("/therapists/:id", requireStaff, async (req, res) => {
  const id = String(req.params.id);
  if (req.user!.role === "THERAPIST" && req.user!.therapistId !== id) throw forbidden();
  const t = await prisma.therapist.findUnique({ where: { id }, include: { user: { select: { firstName: true, lastName: true, avatar: true } } } });
  if (!t) throw notFound("درمانگر یافت نشد");
  const from = req.query.from ? startOfDay(new Date(String(req.query.from))) : startOfDay(new Date(Date.now() - 29 * 86400000));
  const to = req.query.to ? endOfDay(new Date(String(req.query.to))) : endOfDay(new Date());
  const st = await therapistStats(id, from, to);
  res.json({ therapist: { id: t.id, fullName: `${t.user.firstName} ${t.user.lastName}`, avatar: t.user.avatar, color: t.color, sessionPrice: t.sessionPrice }, from, to, ...st });
});

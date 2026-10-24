import { formatMoney } from "@toranj/shared";
import { prisma, parseJson } from "./prisma.js";
import { getSetting, getSettingBool, getSettingNumber } from "./settings.js";
import { sendTemplateSms } from "./sms/service.js";
import { notifyRole } from "./notify.js";

export interface FinancialSummary {
  totalInvoiced: number; // جمع صورت‌حساب‌های صادرشده (پس از تخفیف)
  totalDiscount: number;
  totalPaid: number; // جمع پرداخت‌ها (شامل پرداخت از کیف پول)
  balance: number; // مثبت = بدهکار، منفی = بستانکار
  walletBalance: number;
  openInvoices: number;
  nextDueDate: Date | null;
  overdueAmount: number;
  isSettled: boolean;
}

export async function patientFinancialSummary(patientId: string): Promise<FinancialSummary> {
  const [invoices, payments, wallet] = await Promise.all([
    prisma.invoice.findMany({ where: { patientId, status: { not: "CANCELLED" } }, select: { total: true, discount: true, paid: true, dueDate: true, status: true } }),
    prisma.payment.aggregate({ where: { patientId }, _sum: { amount: true } }),
    prisma.walletTransaction.aggregate({ where: { patientId }, _sum: { amount: true } }),
  ]);
  const issued = invoices.filter((i) => i.status !== "DRAFT");
  const totalInvoiced = issued.reduce((s, i) => s + i.total, 0);
  const totalDiscount = issued.reduce((s, i) => s + i.discount, 0);
  const totalPaid = payments._sum.amount ?? 0;
  const balance = totalInvoiced - totalPaid;
  const now = new Date();
  const open = issued.filter((i) => i.status === "ISSUED" || i.status === "PARTIAL");
  const nextDue = open.map((i) => i.dueDate).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const overdueAmount = open.filter((i) => i.dueDate && i.dueDate < now).reduce((s, i) => s + (i.total - i.paid), 0);
  return {
    totalInvoiced,
    totalDiscount,
    totalPaid,
    balance,
    walletBalance: wallet._sum.amount ?? 0,
    openInvoices: open.length,
    nextDueDate: nextDue,
    overdueAmount,
    isSettled: balance <= 0,
  };
}

/** وضعیت صورت‌حساب را بر اساس مجموع پرداخت‌های متصل به آن به‌روز می‌کند */
export async function recomputeInvoice(invoiceId: string) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv || inv.status === "CANCELLED" || inv.status === "DRAFT") return inv;
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const status = paid <= 0 ? "ISSUED" : paid >= inv.total ? "PAID" : "PARTIAL";
  return prisma.invoice.update({ where: { id: invoiceId }, data: { paid, status } });
}

export interface DebtItem {
  id: string;
  number: string;
  kind: "DEBT" | "SESSION" | "INVOICE";
  title: string;
  note: string | null;
  date: Date;
  total: number;
  paid: number;
  remaining: number;
  status: string;
  sessions: { id: string; startAt: Date; therapistName: string }[];
}

/**
 * ریز بدهی‌های مراجع: هر صورت‌حساب صادرشده (جلسه تسویه‌شده، بدهی دستی، صورت‌حساب) یک ردیف است.
 * پرداخت‌های بدون صورت‌حساب و مازاد پرداخت‌ها به ترتیب از قدیمی‌ترین ردیف کم می‌شوند،
 * تا جمع «مانده» ردیف‌ها همیشه با مانده حساب مراجع یکی باشد.
 */
export async function patientDebtItems(patientId: string): Promise<DebtItem[]> {
  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { patientId, status: { notIn: ["CANCELLED", "DRAFT"] } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: { appointments: { select: { id: true, startAt: true, therapist: { select: { user: { select: { firstName: true, lastName: true } } } } }, orderBy: { startAt: "asc" } } },
    }),
    prisma.payment.aggregate({ where: { patientId }, _sum: { amount: true } }),
  ]);
  const allocated = invoices.reduce((s, i) => s + Math.min(i.paid, i.total), 0);
  let pool = Math.max(0, (payments._sum.amount ?? 0) - allocated);
  return invoices.map((i) => {
    let paid = Math.min(i.paid, i.total);
    const extra = Math.min(pool, i.total - paid);
    paid += extra;
    pool -= extra;
    const items = parseJson<{ title: string }[]>(i.items, []);
    const kind = (i.kind === "DEBT" ? "DEBT" : i.kind === "SESSION" || i.appointments.length ? "SESSION" : "INVOICE") as DebtItem["kind"];
    return {
      id: i.id,
      number: i.number,
      kind,
      title: items.map((x) => x.title).filter(Boolean).join("، ") || (kind === "DEBT" ? "بدهی" : "صورت‌حساب"),
      note: i.notes,
      date: i.date,
      total: i.total,
      paid,
      remaining: i.total - paid,
      status: i.total - paid <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "ISSUED",
      sessions: i.appointments.map((a) => ({ id: a.id, startAt: a.startAt, therapistName: `${a.therapist.user.firstName} ${a.therapist.user.lastName}` })),
    };
  }).reverse();
}

/**
 * هشدار بدهی بالا: اگر مانده بدهی از سقف تنظیمات بیشتر شود، یک بار پیامک و اعلان مدیر؛
 * وقتی دوباره زیر سقف برگردد، علامت پاک می‌شود تا عبور بعدی دوباره اطلاع داده شود.
 */
export async function checkDebtAlert(patientId: string) {
  try {
    const threshold = await getSettingNumber("finance.debtAlertThreshold", 6000000);
    const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, firstName: true, lastName: true, phone: true, fileNumber: true, debtAlertSentAt: true } });
    if (!p) return;
    const { balance } = await patientFinancialSummary(patientId);
    if (threshold <= 0 || balance <= threshold) {
      if (p.debtAlertSentAt) await prisma.patient.update({ where: { id: p.id }, data: { debtAlertSentAt: null } });
      return;
    }
    if (p.debtAlertSentAt) return;
    await prisma.patient.update({ where: { id: p.id }, data: { debtAlertSentAt: new Date() } });
    const currency = await getSetting("finance.currency", "تومان");
    const name = `${p.firstName} ${p.lastName}`;
    await notifyRole("ADMIN", "بدهی بالای سقف", `بدهی ${name} (${p.fileNumber}) به ${formatMoney(balance, currency)} رسید`, `/panel/patients/${p.id}?tab=finance`);
    if (await getSettingBool("sms.autoDebtAlert", true)) {
      const phone = await getSetting("clinic.phone", "");
      await sendTemplateSms("debt_threshold", p.phone, { name, balance: formatMoney(balance, ""), currency, phone }, { related: { type: "patient", id: p.id } });
    }
  } catch (e) {
    console.error("debt alert failed", e);
  }
}

/**
 * تخصیص دوباره پرداخت‌های یک مراجع به بدهی‌هایش (قدیمی‌ترین بدهی اول).
 * - اگر صورت‌حسابی بیش از مبلغش پرداخت دارد (مثلاً مبلغ جلسه کم شد)، مازاد آزاد می‌شود و بستانکاری می‌شود.
 * - پرداخت‌های آزاد (پیش‌پرداخت/بستانکاری) خودکار صرف بدهی‌های باز می‌شوند.
 * - هر دریافت یک «رسید» (groupId) است؛ اگر بین چند بدهی تقسیم شود، سهم‌ها همان رسید را دارند
 *   تا در «پایان کار» یک ردیف دیده شود. جمع پرداخت‌ها و جمع بدهی‌ها هرگز تغییر نمی‌کند.
 */
export async function rebalancePatient(patientId: string) {
  await prisma.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({ where: { patientId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], include: { payments: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] } } });
    const active = (s: string) => s !== "CANCELLED" && s !== "DRAFT";
    const split = async (p: { id: string; groupId: string | null }, keep: number, moveOut: number, toInvoiceId: string | null) => {
      const groupId = p.groupId ?? p.id;
      const src = await tx.payment.update({ where: { id: p.id }, data: { amount: keep, groupId } });
      return tx.payment.create({ data: { patientId: src.patientId, invoiceId: toInvoiceId, amount: moveOut, method: src.method, reference: src.reference, note: src.note, date: src.date, receivedById: src.receivedById, groupId, createdAt: src.createdAt } });
    };
    // ۱) آزاد کردن پرداخت‌های صورت‌حساب‌های لغوشده و مازاد صورت‌حساب‌های بیش‌پرداخت
    for (const inv of invoices) {
      if (!active(inv.status)) {
        if (inv.payments.length) await tx.payment.updateMany({ where: { invoiceId: inv.id }, data: { invoiceId: null } });
        continue;
      }
      let excess = inv.payments.reduce((s, p) => s + p.amount, 0) - inv.total;
      for (const p of inv.payments) {
        if (excess <= 0) break;
        if (p.amount <= excess) { await tx.payment.update({ where: { id: p.id }, data: { invoiceId: null } }); excess -= p.amount; }
        else { await split(p, p.amount - excess, excess, null); excess = 0; }
      }
    }
    // ۲) صرف پرداخت‌های آزاد برای بدهی‌های باز (قدیمی‌ترین اول)
    const open = (await tx.invoice.findMany({ where: { patientId, status: { notIn: ["CANCELLED", "DRAFT"] } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], include: { payments: { select: { amount: true } } } }))
      .map((i) => ({ id: i.id, due: i.total - i.payments.reduce((s, p) => s + p.amount, 0) }))
      .filter((i) => i.due > 0);
    const free = await tx.payment.findMany({ where: { patientId, invoiceId: null }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
    let k = 0;
    for (const p0 of free) {
      let p: { id: string; groupId: string | null; amount: number } = p0;
      while (k < open.length && p.amount > 0) {
        const inv = open[k];
        if (p.amount <= inv.due) {
          await tx.payment.update({ where: { id: p.id }, data: { invoiceId: inv.id } });
          inv.due -= p.amount;
          if (inv.due === 0) k++;
          p = { ...p, amount: 0 };
        } else {
          const rest = await split(p, inv.due, p.amount - inv.due, null);
          await tx.payment.update({ where: { id: p.id }, data: { invoiceId: inv.id } });
          inv.due = 0;
          k++;
          p = rest;
        }
      }
      if (k >= open.length) break;
    }
    // ۳) وضعیت صورت‌حساب‌ها
    const all = await tx.invoice.findMany({ where: { patientId }, include: { payments: { select: { amount: true } } } });
    for (const inv of all) {
      if (!active(inv.status)) continue;
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      const status = paid <= 0 ? "ISSUED" : paid >= inv.total ? "PAID" : "PARTIAL";
      if (paid !== inv.paid || status !== inv.status) await tx.invoice.update({ where: { id: inv.id }, data: { paid, status } });
    }
  });
  await checkDebtAlert(patientId);
}

/** همه سهم‌های یک رسید (برای ویرایش/حذف یک دریافت به‌صورت یکجا) */
export async function paymentGroup(paymentId: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) return null;
  const rows = p.groupId ? await prisma.payment.findMany({ where: { groupId: p.groupId }, orderBy: { createdAt: "asc" } }) : [p];
  return { first: rows[0], rows, total: rows.reduce((s, r) => s + r.amount, 0) };
}

/**
 * مبلغ واقعی جلسه = کارکرد درمانگر = مبلغی که از مراجع کسر می‌شود.
 * با تغییر آن، صورت‌حساب همان جلسه هم اصلاح و حساب مراجع دوباره تخصیص داده می‌شود.
 */
export async function syncSessionAmount(appointmentId: string, amount: number) {
  const a = await prisma.appointment.update({ where: { id: appointmentId }, data: { price: amount, therapistAmount: amount }, include: { invoice: { include: { appointments: { select: { id: true, startAt: true }, orderBy: { startAt: "asc" } } } } } });
  const inv = a.invoice;
  if (inv && inv.status !== "CANCELLED") {
    const items = parseJson<{ title: string; qty: number; unitPrice: number }[]>(inv.items, []);
    const idx = inv.appointments.length === 1 ? (items.length === 1 ? 0 : -1) : items.length === inv.appointments.length ? inv.appointments.findIndex((x) => x.id === a.id) : -1;
    if (idx >= 0 && items[idx].unitPrice !== amount) {
      items[idx] = { ...items[idx], unitPrice: amount };
      const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
      const discount = Math.min(inv.discount, subtotal);
      await prisma.invoice.update({ where: { id: inv.id }, data: { items: JSON.stringify(items), subtotal, discount, total: subtotal - discount } });
    }
  }
  await rebalancePatient(a.patientId);
  return a;
}

/**
 * یک‌بار پس از آپدیت: ردیف‌های پرداختی که قبلاً از یک دریافت تکه‌تکه ثبت شده‌اند (همان مراجع، همان روش،
 * همان ثبت‌کننده و همان لحظه) یک رسید می‌شوند، و حساب همه مراجعین یک بار دوباره تخصیص داده می‌شود.
 * جمع پرداخت‌ها و مانده هیچ مراجعی تغییر نمی‌کند.
 */
export async function migratePaymentGroups() {
  const FLAG = "system.migrate.paymentGroups";
  if ((await prisma.setting.findUnique({ where: { key: FLAG } }))?.value === "done") return;
  const rows = await prisma.payment.findMany({ where: { groupId: null }, orderBy: [{ patientId: "asc" }, { createdAt: "asc" }] });
  let cur: { key: string; first: (typeof rows)[number]; ids: string[] } | null = null;
  const flush = async () => { if (cur && cur.ids.length > 1) await prisma.payment.updateMany({ where: { id: { in: cur.ids } }, data: { groupId: cur.first.id } }); };
  for (const r of rows) {
    const key = `${r.patientId}|${r.method}|${r.receivedById ?? ""}|${r.reference ?? ""}`;
    if (cur && cur.key === key && r.createdAt.getTime() - cur.first.createdAt.getTime() <= 5000) cur.ids.push(r.id);
    else { await flush(); cur = { key, first: r, ids: [r.id] }; }
  }
  await flush();
  const patients = await prisma.patient.findMany({ where: { OR: [{ invoices: { some: {} } }, { payments: { some: {} } }] }, select: { id: true } });
  for (const p of patients) await rebalancePatient(p.id);
  await prisma.setting.upsert({ where: { key: FLAG }, create: { key: FLAG, value: "done", group: "general", label: "system", type: "text", secret: true }, update: { value: "done" } });
  console.log(`💳 payment receipts merged; ${patients.length} patient accounts re-allocated`);
}

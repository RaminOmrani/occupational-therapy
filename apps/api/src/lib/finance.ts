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

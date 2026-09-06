import { prisma } from "./prisma.js";

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

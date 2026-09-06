"use client";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Printer, ArrowRight, Ban } from "lucide-react";
import { formatJalali, formatJalaliLong, formatMoney, toPersianDigits, PAYMENT_METHOD_LABELS } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Spinner, useConfirm } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LogoMark } from "@/components/layout/Logo";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["invoice", id], queryFn: () => api.get<any>(`/finance/invoices/${id}`) });
  if (isLoading || !data) return <Spinner />;
  const inv = data.invoice;
  const cancel = async () => { if (!(await confirm("این صورت‌حساب باطل شود؟"))) return; try { await api.patch(`/finance/invoices/${id}`, { status: "CANCELLED" }); toast.success("باطل شد"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } catch (e: any) { toast.error(e.message); } };
  return (
    <div className="mx-auto max-w-3xl">
      {dialog}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={user?.role === "PATIENT" ? "/panel/my/finance" : `/panel/patients/${inv.patientId}?tab=finance`} className="btn-ghost"><ArrowRight className="h-4 w-4" />بازگشت</Link>
        <div className="flex gap-2">{user?.role === "ADMIN" && inv.status !== "CANCELLED" && <Button variant="ghost" className="text-coral-600" onClick={cancel} icon={<Ban className="h-4 w-4" />}>ابطال</Button>}<Button onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ</Button></div>
      </div>
      <div className="card p-8 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-sand-200 pb-6">
          <div className="flex items-center gap-3"><LogoMark className="h-14 w-14" /><div><h1 className="text-xl font-black text-brand-800">{data.clinic.name}</h1><p className="text-xs text-slate-500">{data.clinic.address}</p><p className="num text-xs text-slate-500">{toPersianDigits(data.clinic.phone)}</p></div></div>
          <div className="text-left"><p className="text-xs text-slate-400">صورت‌حساب</p><p className="num text-lg font-black">{inv.number}</p><StatusBadge status={inv.status} /></div>
        </div>
        <div className="grid gap-4 py-6 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-slate-400">بیمار</p><p className="font-bold">{inv.patientName}</p><p className="num text-xs text-slate-500">پرونده {inv.patient.fileNumber}</p></div>
          <div><p className="text-xs text-slate-400">تاریخ صدور</p><p className="num font-medium">{formatJalaliLong(inv.date)}</p></div>
          <div><p className="text-xs text-slate-400">مهلت پرداخت</p><p className="num font-medium">{inv.dueDate ? formatJalaliLong(inv.dueDate) : "-"}</p></div>
        </div>
        <table className="table">
          <thead><tr><th>#</th><th>شرح</th><th>تعداد</th><th>قیمت واحد</th><th>مبلغ</th></tr></thead>
          <tbody>{inv.items.map((it: any, i: number) => <tr key={i}><td className="num">{toPersianDigits(i + 1)}</td><td>{it.title}</td><td className="num">{toPersianDigits(it.qty)}</td><td className="num">{formatMoney(it.unitPrice, "")}</td><td className="num font-medium">{formatMoney(it.qty * it.unitPrice, "")}</td></tr>)}</tbody>
        </table>
        <div className="mt-6 flex justify-end">
          <dl className="w-64 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">جمع</dt><dd className="num">{formatMoney(inv.subtotal)}</dd></div>
            {inv.discount > 0 && <div className="flex justify-between text-amber-600"><dt>تخفیف{inv.discountNote ? ` (${inv.discountNote})` : ""}</dt><dd className="num">− {formatMoney(inv.discount)}</dd></div>}
            <div className="flex justify-between border-t border-sand-200 pt-2 text-base font-black"><dt>قابل پرداخت</dt><dd className="num text-brand-700">{formatMoney(inv.total)}</dd></div>
            <div className="flex justify-between text-sage-700"><dt>پرداخت‌شده</dt><dd className="num">{formatMoney(inv.paid)}</dd></div>
            <div className="flex justify-between font-bold text-coral-600"><dt>مانده</dt><dd className="num">{formatMoney(Math.max(0, inv.total - inv.paid))}</dd></div>
          </dl>
        </div>
        {inv.payments.length > 0 && (
          <div className="mt-6 border-t border-sand-200 pt-4">
            <p className="mb-2 text-xs font-bold text-slate-500">پرداخت‌های این صورت‌حساب</p>
            <ul className="space-y-1 text-xs">{inv.payments.map((p: any) => <li key={p.id} className="flex justify-between"><span>{formatJalali(p.date)} · {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}{p.reference ? ` · ${p.reference}` : ""}</span><b className="num">{formatMoney(p.amount)}</b></li>)}</ul>
          </div>
        )}
        {inv.notes && <p className="mt-6 text-xs text-slate-500">{inv.notes}</p>}
      </div>
    </div>
  );
}

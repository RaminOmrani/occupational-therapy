"use client";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Printer, ArrowRight, Ban } from "lucide-react";
import { formatJalali, formatJalaliLong, formatMoney, toPersianDigits, PAYMENT_METHOD_LABELS, INVOICE_STATUS_LABELS } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePublicSettings } from "@/lib/settings";
import { Button, Spinner, useConfirm } from "@/components/ui";
import { LogoMark } from "@/components/layout/Logo";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const s = usePublicSettings();
  const { confirm, dialog } = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["invoice", id], queryFn: () => api.get<any>(`/finance/invoices/${id}`) });
  if (isLoading || !data) return <Spinner />;
  const inv = data.invoice;
  const remaining = Math.max(0, inv.total - inv.paid);
  const cancel = async () => { if (!(await confirm("این صورت‌حساب باطل شود؟"))) return; try { await api.patch(`/finance/invoices/${id}`, { status: "CANCELLED" }); toast.success("باطل شد"); qc.invalidateQueries({ queryKey: ["invoice", id] }); } catch (e: any) { toast.error(e.message); } };
  const Row = ({ l, v, strong, tone }: { l: string; v: string; strong?: boolean; tone?: string }) => (
    <tr className={strong ? "font-black" : ""}><td className="border border-sand-300 bg-sand-100 px-3 py-1.5 text-xs">{l}</td><td className={`num border border-sand-300 px-3 py-1.5 text-right ${tone ?? ""}`}>{v}</td></tr>
  );
  return (
    <div className="mx-auto max-w-3xl">
      {dialog}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={user?.role === "PATIENT" ? "/panel/my/finance" : `/panel/patients/${inv.patientId}?tab=finance`} className="btn-ghost"><ArrowRight className="h-4 w-4" />بازگشت</Link>
        <div className="flex gap-2">{user?.role === "ADMIN" && inv.status !== "CANCELLED" && <Button variant="ghost" className="text-coral-600" onClick={cancel} icon={<Ban className="h-4 w-4" />}>ابطال</Button>}<Button onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ / ذخیره PDF</Button></div>
      </div>

      <div className="print-sheet card relative p-8 text-slate-900">
        {inv.status === "CANCELLED" && <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className="-rotate-12 rounded-2xl border-4 border-coral-500 px-8 py-3 text-4xl font-black text-coral-500 opacity-40">باطل شد</span></div>}
        {/* سربرگ */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-brand-700 pb-4">
          <div className="flex items-center gap-3">
            <LogoMark className="h-16 w-16" />
            <div>
              <h1 className="text-xl font-black text-brand-800">{data.clinic.name}</h1>
              <p className="mt-1 text-xs text-slate-600">{data.clinic.address}</p>
              <p className="num text-xs text-slate-600">تلفن: {toPersianDigits(data.clinic.phone)}{s.str("clinic.licenseNo") ? ` · شماره نظام: ${s.str("clinic.licenseNo")}` : ""}</p>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-brand-700 px-5 py-3 text-center">
            <p className="text-sm font-black text-brand-800">صورت‌حساب</p>
            <p className="num mt-1 text-lg font-black">{inv.number}</p>
            <p className="mt-1 text-[11px] text-slate-500">{INVOICE_STATUS_LABELS[inv.status as keyof typeof INVOICE_STATUS_LABELS] ?? inv.status}</p>
          </div>
        </div>

        {/* مشخصات */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-sand-300 p-3 text-sm sm:grid-cols-4">
          <div><p className="text-[11px] text-slate-500">نام بیمار</p><p className="font-bold">{inv.patientName}</p></div>
          <div><p className="text-[11px] text-slate-500">شماره پرونده</p><p className="num font-bold">{inv.patient.fileNumber}</p></div>
          <div><p className="text-[11px] text-slate-500">تاریخ صدور</p><p className="num font-bold">{formatJalaliLong(inv.date)}</p></div>
          <div><p className="text-[11px] text-slate-500">مهلت پرداخت</p><p className="num font-bold">{inv.dueDate ? formatJalaliLong(inv.dueDate) : "-"}</p></div>
        </div>

        {/* اقلام */}
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-700 text-white">
              <th className="border border-brand-700 px-2 py-2 text-center font-bold">ردیف</th>
              <th className="border border-brand-700 px-3 py-2 text-right font-bold">شرح خدمات</th>
              <th className="border border-brand-700 px-2 py-2 text-center font-bold">تعداد</th>
              <th className="border border-brand-700 px-3 py-2 text-center font-bold">قیمت واحد</th>
              <th className="border border-brand-700 px-3 py-2 text-center font-bold">مبلغ کل</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it: any, i: number) => (
              <tr key={i} className={i % 2 ? "bg-sand-50" : ""}>
                <td className="num border border-sand-300 px-2 py-2 text-center">{toPersianDigits(i + 1)}</td>
                <td className="border border-sand-300 px-3 py-2">{it.title}</td>
                <td className="num border border-sand-300 px-2 py-2 text-center">{toPersianDigits(it.qty)}</td>
                <td className="num border border-sand-300 px-3 py-2 text-center">{formatMoney(it.unitPrice, "")}</td>
                <td className="num border border-sand-300 px-3 py-2 text-center font-medium">{formatMoney(it.qty * it.unitPrice, "")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* جمع‌ها (سمت راست) و توضیحات */}
        <div className="mt-4 flex flex-col items-start justify-between gap-4 sm:flex-row">
          <table className="w-72 whitespace-nowrap shrink-0 border-collapse text-sm">
            <tbody>
              <Row l="جمع اقلام" v={formatMoney(inv.subtotal)} />
              {inv.discount > 0 && <Row l={`تخفیف${inv.discountNote ? ` (${inv.discountNote})` : ""}`} v={`− ${formatMoney(inv.discount)}`} tone="text-amber-600" />}
              <Row l="قابل پرداخت" v={formatMoney(inv.total)} strong tone="text-brand-800" />
              <Row l="پرداخت‌شده" v={formatMoney(inv.paid)} tone="text-sage-700" />
              <Row l="مانده" v={formatMoney(remaining)} strong tone={remaining > 0 ? "text-coral-600" : "text-sage-700"} />
            </tbody>
          </table>
          <div className="flex-1 text-xs leading-6 text-slate-600">
            {inv.notes && <p><b>توضیحات:</b> {inv.notes}</p>}
            {inv.payments.length > 0 && (
              <div className="mt-2">
                <p className="font-bold text-slate-700">پرداخت‌های ثبت‌شده:</p>
                <ul className="mt-1 space-y-0.5">{inv.payments.map((p: any) => <li key={p.id} className="num">{formatJalali(p.date)} · {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}{p.reference ? ` · پیگیری ${toPersianDigits(p.reference)}` : ""} · <b>{formatMoney(p.amount)}</b></li>)}</ul>
              </div>
            )}
            {s.str("finance.cardNumber") && remaining > 0 && <p className="mt-2 rounded-lg bg-sand-100 p-2">پرداخت کارت‌به‌کارت: <b className="num" dir="ltr">{toPersianDigits(s.str("finance.cardNumber"))}</b>{s.str("finance.cardOwner") ? ` به نام ${s.str("finance.cardOwner")}` : ""}</p>}
          </div>
        </div>

        {/* امضا */}
        <div className="mt-10 grid grid-cols-2 gap-6 text-center text-xs text-slate-500">
          <div><div className="mx-auto mb-2 h-14 w-40 border-b border-dashed border-sand-400" />مهر و امضای کلینیک</div>
          <div><div className="mx-auto mb-2 h-14 w-40 border-b border-dashed border-sand-400" />امضای پرداخت‌کننده</div>
        </div>
        <p className="mt-6 border-t border-sand-200 pt-3 text-center text-[11px] text-slate-400">{data.clinic.name} · {data.clinic.address} · {toPersianDigits(data.clinic.phone)}</p>
      </div>
    </div>
  );
}

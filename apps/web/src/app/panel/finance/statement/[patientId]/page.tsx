"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Printer, ArrowRight } from "lucide-react";
import { formatJalali, formatJalaliLong, formatMoney } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Spinner } from "@/components/ui";
import { LogoMark } from "@/components/layout/Logo";

export default function StatementPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["statement", patientId], queryFn: () => api.get<any>(`/finance/patients/${patientId}/statement`) });
  const { data: p } = useQuery({ queryKey: ["patient", patientId], queryFn: () => api.get<any>(`/patients/${patientId}`) });
  if (isLoading || !data) return <Spinner />;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between"><Link href={user?.role === "PATIENT" ? "/panel/my/finance" : `/panel/patients/${patientId}?tab=finance`} className="btn-ghost"><ArrowRight className="h-4 w-4" />بازگشت</Link><Button onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ</Button></div>
      <div className="print-sheet card p-8">
        <div className="flex items-center justify-between border-b border-sand-200 pb-4"><div className="flex items-center gap-3"><LogoMark /><h1 className="text-lg font-black text-brand-800">صورت‌حساب کلی</h1></div><p className="num text-xs text-slate-500">{formatJalaliLong(new Date())}</p></div>
        {p && <p className="mt-4 text-sm">بیمار: <b>{p.patient.fullName}</b> <span className="num text-slate-500">({p.patient.fileNumber})</span></p>}
        <table className="table mt-4">
          <thead><tr><th>تاریخ</th><th>شرح</th><th>مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead>
          <tbody>{data.lines.map((l: any, i: number) => <tr key={i}><td className="num">{formatJalali(l.date)}</td><td>{l.description}</td><td className="num text-xs">{l.ref}</td><td className="num text-coral-600">{l.debit ? formatMoney(l.debit, "") : ""}</td><td className="num text-sage-700">{l.credit ? formatMoney(l.credit, "") : ""}</td><td className="num font-medium">{formatMoney(l.balance, "")}</td></tr>)}</tbody>
        </table>
        <div className="mt-6 flex justify-start"><p className="text-base">مانده نهایی: <b className={`num ${data.balance > 0 ? "text-coral-600" : "text-sage-700"}`}>{data.balance === 0 ? "تسویه‌شده" : `${formatMoney(Math.abs(data.balance))} ${data.balance > 0 ? "بدهکار" : "بستانکار"}`}</b></p></div>
      </div>
    </div>
  );
}

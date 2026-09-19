"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Printer, CalendarCheck2, Wallet, AlertTriangle, ReceiptText } from "lucide-react";
import { PAYMENT_METHOD_LABELS, addDays, formatJalali, formatJalaliLong, formatMoney, formatTime, startOfDay, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { usePublicSettings } from "@/lib/settings";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, Stat } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { SettleModal, SETTLE_METHODS } from "@/components/schedule/SettleModal";
import { cn } from "@/lib/utils";

const METHOD_EMOJI: Record<string, string> = { TRANSFER: "💳", CASH: "💵", CARD: "🏧", WALLET: "👛", ONLINE: "🌐" };

function Inner() {
  const sp = useSearchParams();
  const settings = usePublicSettings();
  const [date, setDate] = useState(() => (sp.get("date") ? startOfDay(new Date(sp.get("date")!)) : startOfDay(new Date())));
  const [settle, setSettle] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["daily", date.toISOString()], queryFn: () => api.get<any>("/finance/daily", { date: date.toISOString() }) });
  const t = data?.totals;
  const methods = ["TRANSFER", "CASH", "CARD", "WALLET", "ONLINE"].filter((m) => m === "TRANSFER" || m === "CASH" || m === "CARD" || (t?.byMethod?.[m] ?? 0) > 0);

  return (
    <>
      <PageHeader title="صورت مالی روزانه (پایان کار)" subtitle="دریافتی‌های روز به تفکیک روش پرداخت و وضعیت تسویه جلسات" icon={<ReceiptText className="h-5 w-5" />} actions={<>
        <Link href={`/panel/schedule?date=${date.toISOString()}`} className="btn-secondary"><CalendarCheck2 className="h-4 w-4" />برنامه این روز</Link>
        <Button variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ</Button>
      </>} />

      <Card className="mb-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setDate(addDays(date, -1))} className="rounded-xl p-2 hover:bg-sand-200"><ChevronRight className="h-5 w-5" /></button>
            <button onClick={() => setDate(startOfDay(new Date()))} className="rounded-xl px-3 py-1.5 text-sm hover:bg-sand-200">امروز</button>
            <button onClick={() => setDate(addDays(date, 1))} className="rounded-xl p-2 hover:bg-sand-200"><ChevronLeft className="h-5 w-5" /></button>
          </div>
          <JalaliDatePicker value={date} onChange={(d) => d && setDate(startOfDay(d))} className="w-40" />
          <span className="text-sm font-bold text-brand-800">{formatJalaliLong(date, true)}</span>
        </div>
      </Card>

      {isLoading || !data ? <Spinner /> : (
        <div className="print-sheet space-y-4">
          <div className="hidden print:block">
            <h1 className="text-lg font-black">{settings.str("clinic.name")} — صورت مالی روز {formatJalaliLong(date, true)}</h1>
          </div>

          {/* دریافتی‌ها به تفکیک روش */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="جمع دریافتی امروز" value={formatMoney(t.received)} icon={<Wallet className="h-5 w-5" />} tone="brand" hint={`${toPersianDigits(data.payments.length)} پرداخت`} />
            {methods.map((m) => (
              <div key={m} className="card flex items-center gap-4 p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sand-100 text-2xl">{METHOD_EMOJI[m]}</span>
                <div className="min-w-0"><p className="text-xs text-slate-500">{m === "CARD" ? "پرداخت پایانه (کارت‌خوان)" : PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS]}</p><p className="num mt-0.5 truncate text-lg font-black text-slate-800">{formatMoney(t.byMethod?.[m] ?? 0)}</p></div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="جلسات انجام‌شده" value={`${toPersianDigits(t.done)} از ${toPersianDigits(t.sessions)}`} tone="sage" hint={`غیبت ${toPersianDigits(t.noShow)} · لغو ${toPersianDigits(t.cancelled)}${t.pending ? ` · در انتظار ${toPersianDigits(t.pending)}` : ""}`} />
            <Stat label="مبلغ جلسات انجام‌شده" value={formatMoney(t.expectedFromSessions)} tone="slate" hint="بر اساس قیمت هر جلسه" />
            <Stat label="جلسات تسویه‌نشده" value={toPersianDigits(t.unsettledSessions)} tone={t.unsettledSessions ? "coral" : "sage"} icon={<AlertTriangle className="h-5 w-5" />} hint={t.unsettledSessions ? "پایین صفحه تسویه کنید" : "همه تسویه شده ✅"} />
            <Stat label="صورت‌حساب‌های امروز" value={formatMoney(t.invoiced)} tone="violet" hint={t.discount ? `تخفیف ${formatMoney(t.discount)}` : undefined} />
          </div>

          {/* پرداخت‌های روز */}
          <Card title="پرداخت‌های ثبت‌شده" subtitle={`${toPersianDigits(data.payments.length)} مورد`} padded={false}>
            {data.payments.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>ساعت</th><th>مراجع</th><th>روش</th><th>مبلغ</th><th>صورت‌حساب</th><th>پیگیری</th><th>ثبت‌کننده</th></tr></thead>
                  <tbody>
                    {data.payments.map((p: any) => (
                      <tr key={p.id}>
                        <td className="num text-xs">{formatTime(p.date)}</td>
                        <td><Link href={`/panel/patients/${p.patientId}?tab=finance`} className="font-medium hover:text-brand-700">{p.patientName}</Link><span className="num mr-2 text-xs text-slate-400">{p.patient?.fileNumber}</span></td>
                        <td className="text-xs">{METHOD_EMOJI[p.method]} {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}</td>
                        <td className="num font-bold text-sage-700">{formatMoney(p.amount)}</td>
                        <td className="num text-xs text-slate-500">{p.invoiceNumber ?? "-"}</td>
                        <td className="num text-xs text-slate-500" dir="ltr">{p.reference ? toPersianDigits(p.reference) : "-"}</td>
                        <td className="text-xs text-slate-500">{p.receivedByName ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-sand-50 font-bold"><td colSpan={3}>جمع</td><td className="num text-brand-800">{formatMoney(t.received)}</td><td colSpan={3} /></tr></tfoot>
                </table>
              </div>
            ) : <EmptyState title="پرداختی برای این روز ثبت نشده" />}
          </Card>

          {!!data.walletDeposits.length && (
            <Card title="شارژ کیف پول" subtitle={formatMoney(t.walletDeposits)} padded={false}>
              <ul className="divide-y divide-sand-100 text-sm">{data.walletDeposits.map((w: any) => <li key={w.id} className="flex items-center justify-between px-5 py-2"><span>{w.patientName}<span className="text-xs text-slate-400"> · {w.description ?? ""}</span></span><span className="num font-bold">{formatMoney(w.amount)}</span></li>)}</ul>
            </Card>
          )}

          {/* جلسات روز */}
          <Card title="جلسات این روز" subtitle="وضعیت انجام و تسویه هر جلسه" padded={false}>
            {data.sessions.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>ساعت</th><th>مراجع</th><th>درمانگر</th><th>وضعیت</th><th>مبلغ جلسه</th><th>تسویه</th><th>مانده حساب مراجع</th><th className="print:hidden" /></tr></thead>
                  <tbody>
                    {data.sessions.map((s: any) => (
                      <tr key={s.id} className={cn(s.status === "DONE" && !s.settled && "bg-coral-50/40")}>
                        <td className="num text-xs">{formatTime(s.startAt)}</td>
                        <td><Link href={`/panel/patients/${s.patientId}`} className="font-medium hover:text-brand-700">{s.patientName}</Link><span className="num mr-2 text-xs text-slate-400">{s.fileNumber}</span></td>
                        <td className="text-xs">{s.therapistName}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td className="num text-xs">{formatMoney(s.price)}</td>
                        <td>{s.status === "DONE" ? (s.settled ? <Badge tone="sage">تسویه‌شده</Badge> : <Badge tone="coral">تسویه‌نشده</Badge>) : s.status === "CANCELLED" || s.status === "NO_SHOW" ? <span className="text-xs text-slate-300">-</span> : <Badge tone="amber">در انتظار انجام</Badge>}</td>
                        <td className={cn("num text-xs", s.balance > 0 ? "text-coral-600" : s.balance < 0 ? "text-sage-700" : "text-slate-400")}>{s.balance > 0 ? `بدهکار ${formatMoney(s.balance)}` : s.balance < 0 ? `بستانکار ${formatMoney(-s.balance)}` : "تسویه"}</td>
                        <td className="print:hidden">{s.status !== "CANCELLED" && !(s.status === "DONE" && s.settled) && <button onClick={() => setSettle(s.id)} className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-700">تسویه</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="برای این روز جلسه‌ای ثبت نشده" />}
          </Card>

          <p className="hidden text-xs text-slate-400 print:block">چاپ در {formatJalali(new Date())} · {SETTLE_METHODS.map((m) => `${m.emoji} ${m.label}`).join(" · ")}</p>
        </div>
      )}
      {settle && <SettleModal appointmentId={settle} onClose={() => setSettle(null)} onDone={() => refetch()} />}
    </>
  );
}

export default function DailyPage() {
  return <Suspense><Inner /></Suspense>;
}

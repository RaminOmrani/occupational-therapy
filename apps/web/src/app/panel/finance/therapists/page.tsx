"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { HandCoins, Printer, ChevronLeft } from "lucide-react";
import { addDays, formatJalali, formatJalaliLong, formatMoney, formatTime, startOfDay, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Spinner, Stat, Tabs } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { cn } from "@/lib/utils";

const RANGES = [{ key: "today", label: "امروز", days: 0 }, { key: "7", label: "۷ روز", days: 6 }, { key: "30", label: "۳۰ روز", days: 29 }, { key: "90", label: "۹۰ روز", days: 89 }];

function Inner() {
  const sp = useSearchParams();
  const { user } = useAuth();
  const [range, setRange] = useState("30");
  const [from, setFrom] = useState<Date | null>(addDays(startOfDay(new Date()), -29));
  const [to, setTo] = useState<Date | null>(startOfDay(new Date()));
  const [selected, setSelected] = useState<string | null>(sp.get("id") ?? (user?.role === "THERAPIST" ? user.therapistId ?? null : null));
  useEffect(() => { const r = RANGES.find((x) => x.key === range); if (r) { setFrom(addDays(startOfDay(new Date()), -r.days)); setTo(startOfDay(new Date())); } }, [range]);
  const params = { from: from?.toISOString(), to: to?.toISOString() };
  const list = useQuery({ queryKey: ["therapists-finance", params], queryFn: () => api.get<{ items: any[] }>("/finance/therapists", params) });
  const detail = useQuery({ queryKey: ["therapist-finance", selected, params], queryFn: () => api.get<any>(`/finance/therapists/${selected}`, params), enabled: !!selected });
  const isTherapist = user?.role === "THERAPIST";
  const d = detail.data;
  return (
    <>
      <PageHeader title={isTherapist ? "کارکرد من" : "کارکرد و تسویه درمانگران"} subtitle="تعداد مراجعین، جلسات، کارکرد و مبلغ وصول‌شده در بازه انتخابی" icon={<HandCoins className="h-5 w-5" />} actions={<Button variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ</Button>} />
      <Card className="mb-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={range} onChange={setRange} tabs={[...RANGES.map((r) => ({ key: r.key, label: r.label })), { key: "custom", label: "دلخواه" }]} />
          <JalaliDatePicker value={from} onChange={(v) => { setRange("custom"); setFrom(v); }} className="w-36" />
          <span className="text-xs text-slate-400">تا</span>
          <JalaliDatePicker value={to} onChange={(v) => { setRange("custom"); setTo(v); }} className="w-36" />
        </div>
      </Card>

      {!isTherapist && (
        <Card padded={false} className="mb-4 overflow-x-auto print-sheet">
          {list.isLoading ? <Spinner /> : list.data?.items.length ? (
            <table className="table">
              <thead><tr><th>درمانگر</th><th>مراجعین</th><th>جلسات</th><th>ارزیابی</th><th>غیبت</th><th>کارکرد</th><th>وصول‌شده</th><th>معوق</th><th className="print:hidden" /></tr></thead>
              <tbody>
                {list.data.items.map((r) => (
                  <tr key={r.therapistId} className={cn(selected === r.therapistId && "bg-brand-50/60")}>
                    <td><button onClick={() => setSelected(r.therapistId)} className="flex items-center gap-2 font-medium hover:text-brand-700"><Avatar name={r.fullName} src={r.avatar} size="sm" />{r.fullName}{!r.isActive && <Badge tone="slate">غیرفعال</Badge>}</button></td>
                    <td className="num">{toPersianDigits(r.cases)}</td><td className="num">{toPersianDigits(r.sessions)}</td><td className="num">{toPersianDigits(r.assessments)}</td><td className="num">{toPersianDigits(r.noShow)}</td>
                    <td className="num font-bold">{formatMoney(r.karkard)}</td><td className="num text-sage-700">{formatMoney(r.collected)}</td><td className={cn("num", r.pending > 0 ? "text-coral-600" : "text-slate-400")}>{formatMoney(r.pending)}</td>
                    <td className="print:hidden"><button onClick={() => setSelected(r.therapistId)} className="text-xs text-brand-600 hover:underline">جزئیات <ChevronLeft className="inline h-3 w-3" /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-sand-50 font-bold"><td>جمع</td><td className="num">{toPersianDigits(list.data.items.reduce((s, r) => s + r.cases, 0))}</td><td className="num">{toPersianDigits(list.data.items.reduce((s, r) => s + r.sessions, 0))}</td><td className="num">{toPersianDigits(list.data.items.reduce((s, r) => s + r.assessments, 0))}</td><td className="num">{toPersianDigits(list.data.items.reduce((s, r) => s + r.noShow, 0))}</td><td className="num">{formatMoney(list.data.items.reduce((s, r) => s + r.karkard, 0))}</td><td className="num text-sage-700">{formatMoney(list.data.items.reduce((s, r) => s + r.collected, 0))}</td><td className="num">{formatMoney(list.data.items.reduce((s, r) => s + r.pending, 0))}</td><td /></tr></tfoot>
            </table>
          ) : <EmptyState title="درمانگری نیست" />}
        </Card>
      )}

      {selected && (detail.isLoading || !d ? <Spinner /> : (
        <div className="print-sheet space-y-4">
          <div className="flex items-center gap-3"><Avatar name={d.therapist.fullName} src={d.therapist.avatar} size="lg" /><div><h2 className="text-lg font-black text-brand-900">{d.therapist.fullName}</h2><p className="text-xs text-slate-500">{formatJalaliLong(d.from)} تا {formatJalaliLong(d.to)}</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="مراجعین (کیس)" value={toPersianDigits(d.cases)} tone="brand" />
            <Stat label="جلسات انجام‌شده" value={toPersianDigits(d.sessions)} tone="sage" hint={`ارزیابی ${toPersianDigits(d.assessments)} · غیبت ${toPersianDigits(d.noShow)}`} />
            <Stat label="کارکرد" value={formatMoney(d.karkard)} tone="violet" />
            <Stat label="وصول‌شده" value={formatMoney(d.collected)} tone="sage" hint="جلساتی که مراجع تسویه کرده" />
            <Stat label="معوق" value={formatMoney(d.pending)} tone={d.pending > 0 ? "coral" : "slate"} hint="جلسات تسویه‌نشده" />
          </div>
          <Card title="تسویه روزانه" subtitle="کارکرد و وصول‌شده به تفکیک روز" padded={false}>
            {d.byDay.length ? (
              <div className="overflow-x-auto"><table className="table"><thead><tr><th>روز</th><th>جلسات</th><th>کارکرد</th><th>وصول‌شده</th><th>معوق</th><th className="print:hidden" /></tr></thead>
                <tbody>{d.byDay.map((r: any) => <tr key={r.date}><td className="font-medium">{formatJalaliLong(r.date, true)}</td><td className="num">{toPersianDigits(r.sessions)}</td><td className="num font-bold">{formatMoney(r.karkard)}</td><td className="num text-sage-700">{formatMoney(r.collected)}</td><td className={cn("num", r.karkard - r.collected > 0 ? "text-coral-600" : "text-slate-400")}>{formatMoney(r.karkard - r.collected)}</td><td className="print:hidden"><Link href={`/panel/finance/daily?date=${r.date}`} className="text-xs text-brand-600 hover:underline">پایان کار آن روز</Link></td></tr>)}</tbody></table></div>
            ) : <EmptyState title="جلسه‌ای در این بازه نیست" />}
          </Card>
          <Card title="ریز جلسات" padded={false}>
            {d.items.length ? (
              <div className="overflow-x-auto"><table className="table"><thead><tr><th>تاریخ</th><th>ساعت</th><th>مراجع</th><th>نوع</th><th>وضعیت</th><th>مبلغ جلسه</th><th>کارکرد</th><th>تسویه</th></tr></thead>
                <tbody>{d.items.map((x: any) => <tr key={x.id}><td className="num text-xs">{formatJalali(x.startAt)}</td><td className="num text-xs">{formatTime(x.startAt)}</td><td>{isTherapist ? x.patientName : <Link href={`/panel/patients/${x.patientId}`} className="hover:text-brand-700">{x.patientName}</Link>}<span className="num mr-2 text-xs text-slate-400">{x.fileNumber}</span></td><td>{x.kind === "ASSESSMENT" ? <Badge tone="violet">ارزیابی</Badge> : <span className="text-xs text-slate-400">درمانی</span>}</td><td><StatusBadge status={x.status} /></td><td className="num text-xs">{formatMoney(x.price)}</td><td className="num font-bold">{x.status === "DONE" ? formatMoney(x.therapistAmount) : "-"}</td><td>{x.status !== "DONE" ? <span className="text-xs text-slate-300">-</span> : x.settled ? <Badge tone="sage">تسویه‌شده</Badge> : <Badge tone="coral">تسویه‌نشده</Badge>}</td></tr>)}</tbody></table></div>
            ) : <EmptyState title="جلسه‌ای نیست" />}
          </Card>
        </div>
      ))}
    </>
  );
}

export default function TherapistsFinancePage() {
  return <Suspense><Inner /></Suspense>;
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, UserPlus, CalendarX, Users, AlertTriangle, Globe, Phone, MessageSquareText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import { addDays, formatJalali, formatMoney, toPersianDigits, JALALI_MONTHS, toJalali } from "@toranj/shared";
import { api } from "@/lib/api";
import { Button, Card, EmptyState, PageHeader, Select, Spinner, Stat } from "@/components/ui";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";

export default function ReportsPage() {
  const [from, setFrom] = useState<Date | null>(addDays(new Date(), -30));
  const [to, setTo] = useState<Date | null>(new Date());
  const [riskDays, setRiskDays] = useState(30);
  const { data, isLoading } = useQuery({ queryKey: ["mgmt-report", from, to, riskDays], queryFn: () => api.get<any>("/reports/management", { from: from?.toISOString(), to: to?.toISOString(), riskDays }) });
  const smsAtRisk = async () => {
    if (!data?.atRisk.length) return;
    try { await api.post("/sms/campaigns", { name: `پیگیری بیماران غایب (${toPersianDigits(riskDays)} روز)`, message: "{{name}} عزیز، مدتی است در جلسات کاردرمانی حضور نداشته‌اید. برای ادامه روند درمان و تعیین نوبت با ما تماس بگیرید.", filters: { audience: "patients", patientIds: data.atRisk.map((p: any) => p.id) } }); toast.success("پیامک پیگیری برای بیماران در خطر ریزش ارسال شد"); } catch (e: any) { toast.error(e.message); }
  };
  if (isLoading || !data) return <Spinner />;
  const monthLabel = (iso: string) => { const j = toJalali(new Date(iso)); return `${JALALI_MONTHS[j.jm - 1]} ${toPersianDigits(String(j.jy).slice(2))}`; };
  return (
    <>
      <PageHeader title="گزارش‌های مدیریتی" subtitle="نرخ تبدیل، غیبت، عملکرد درمانگران و بیماران در خطر ریزش" icon={<BarChart3 className="h-5 w-5" />} actions={<><JalaliDatePicker value={from} onChange={setFrom} className="w-36" /><JalaliDatePicker value={to} onChange={setTo} className="w-36" /></>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="نرخ تبدیل لید به بیمار" value={`${toPersianDigits(data.leads.rate)}٪`} icon={<UserPlus className="h-6 w-6" />} hint={`${toPersianDigits(data.leads.converted)} از ${toPersianDigits(data.leads.total)} لید`} />
        <Stat label="نرخ غیبت (No-show)" value={`${toPersianDigits(data.appointments.noShowRate)}٪`} icon={<CalendarX className="h-6 w-6" />} tone="coral" hint={`${toPersianDigits(data.appointments.byStatus.NO_SHOW ?? 0)} غیبت از ${toPersianDigits(data.appointments.total)} نوبت`} />
        <Stat label="بیماران جدید" value={toPersianDigits(data.newPatients)} icon={<Users className="h-6 w-6" />} tone="sage" hint={`${toPersianDigits(data.appointments.webBookings)} نوبت از سایت`} />
        <Stat label="در خطر ریزش" value={toPersianDigits(data.atRisk.length)} icon={<AlertTriangle className="h-6 w-6" />} tone="amber" hint={`بدون مراجعه بیش از ${toPersianDigits(riskDays)} روز`} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="عملکرد درمانگران" subtitle="در بازه انتخابی" padded={false} className="overflow-x-auto">
          <table className="table"><thead><tr><th>درمانگر</th><th>جلسات</th><th>بیماران</th><th>غیبت</th><th>لغو</th><th>درآمد جلسات</th></tr></thead>
            <tbody>{data.perTherapist.map((t: any) => <tr key={t.id}><td className="flex items-center gap-2 font-medium"><span className="h-3 w-3 rounded-full" style={{ background: t.color }} />{t.name}</td><td className="num">{toPersianDigits(t.sessions)}</td><td className="num">{toPersianDigits(t.patients)}</td><td className="num text-coral-600">{toPersianDigits(t.noShow)}</td><td className="num text-slate-400">{toPersianDigits(t.cancelled)}</td><td className="num font-bold text-brand-700">{formatMoney(t.revenue)}</td></tr>)}</tbody></table>
        </Card>
        <Card title="روند ۶ ماه اخیر" subtitle="بیماران جدید و جلسات انجام‌شده">
          <div className="h-64" dir="ltr"><ResponsiveContainer><BarChart data={data.newPatientsTrend.map((m: any) => ({ ...m, label: monthLabel(m.month) }))}><XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} /><YAxis tick={{ fontSize: 10 }} width={28} allowDecimals={false} /><Tooltip contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12, direction: "rtl" }} formatter={(v: any, n: any) => [toPersianDigits(v), n === "count" ? "بیمار جدید" : "جلسه"]} /><Legend formatter={(v) => (v === "count" ? "بیمار جدید" : "جلسات")} wrapperStyle={{ fontFamily: "Vazirmatn", fontSize: 12 }} /><Bar dataKey="sessions" fill="#178a6e" radius={[6, 6, 0, 0]} /><Bar dataKey="count" fill="#e76f51" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Card>
      </div>
      <Card className="mt-5" title="بیماران در خطر ریزش" subtitle="بیماران فعال بدون نوبت آینده که مدتی مراجعه نکرده‌اند" actions={<><Select value={riskDays} onChange={(e) => setRiskDays(Number(e.target.value))} className="w-36">{[14, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{toPersianDigits(d)} روز</option>)}</Select><Button size="sm" variant="secondary" onClick={smsAtRisk} disabled={!data.atRisk.length} icon={<MessageSquareText className="h-4 w-4" />}>پیامک پیگیری به همه</Button></>} padded={false}>
        {data.atRisk.length ? (
          <table className="table"><thead><tr><th>بیمار</th><th>پرونده</th><th>موبایل</th><th>درمانگر</th><th>آخرین مراجعه</th><th>روز گذشته</th></tr></thead>
            <tbody>{data.atRisk.map((p: any) => <tr key={p.id}><td><Link href={`/panel/patients/${p.id}`} className="font-medium hover:text-brand-700">{p.fullName}</Link></td><td className="num text-xs">{p.fileNumber}</td><td className="num text-xs" dir="ltr"><a href={`tel:${p.phone}`} className="flex items-center gap-1"><Phone className="h-3 w-3" />{toPersianDigits(p.phone)}</a></td><td className="text-xs">{p.therapist ?? "-"}</td><td className="num text-xs">{p.lastVisit ? formatJalali(p.lastVisit) : "هرگز"}</td><td className="num font-bold text-amber-600">{p.daysSince !== null ? toPersianDigits(p.daysSince) : "-"}</td></tr>)}</tbody></table>
        ) : <EmptyState title="بیماری در خطر ریزش نیست 🎉" />}
      </Card>
    </>
  );
}

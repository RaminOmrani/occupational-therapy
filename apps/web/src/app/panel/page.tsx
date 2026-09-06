"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, UserPlus, CalendarDays, Wallet, AlertCircle, Cake, MessageSquareHeart, MessageSquareText, TrendingUp, CalendarCheck, Clock, Dumbbell, Target, ArrowLeft, ClipboardList } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { formatJalali, formatJalaliLong, formatMoney, formatTime, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, PageHeader, Spinner, Stat, EmptyState, Avatar, ProgressBar, Badge } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<any>("/dashboard"), refetchInterval: 120_000 });
  if (isLoading || !data) return <Spinner />;
  if (data.role === "PATIENT") return <PatientDashboard d={data} />;
  if (data.role === "THERAPIST") return <TherapistDashboard d={data} />;
  return <AdminDashboard d={data} isAdmin={user?.role === "ADMIN"} />;
}

function Greeting() {
  const { user } = useAuth();
  const h = new Date().getHours();
  const g = h < 12 ? "صبح بخیر" : h < 17 ? "ظهر بخیر" : "عصر بخیر";
  return `${g}، ${user?.firstName} عزیز 👋`;
}

function AppointmentRow({ a, showTherapist = true, showPatient = true }: { a: any; showTherapist?: boolean; showPatient?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="num w-12 shrink-0 rounded-xl bg-sand-100 py-1 text-center text-sm font-bold text-brand-700">{formatTime(a.startAt)}</span>
      <span className="h-8 w-1 rounded-full" style={{ background: a.therapistColor }} />
      <div className="min-w-0 flex-1">
        {showPatient && <Link href={`/panel/patients/${a.patientId}`} className="block truncate text-sm font-medium hover:text-brand-700">{a.patientName}</Link>}
        {showTherapist && <p className="truncate text-xs text-slate-400">{a.therapistName}</p>}
      </div>
      <StatusBadge status={a.status} />
    </li>
  );
}

function AdminDashboard({ d, isAdmin }: { d: any; isAdmin: boolean }) {
  return (
    <>
      <PageHeader title={<Greeting />} subtitle={formatJalaliLong(new Date(), true)} actions={<Link href="/panel/schedule" className="btn-primary"><CalendarDays className="h-4 w-4" />برنامه‌ریزی روز</Link>} />
      {d.unfixedTomorrow > 0 && (
        <Link href="/panel/schedule?day=1" className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-600 hover:bg-amber-400/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span><b>{toPersianDigits(d.unfixedTomorrow)}</b> نوبت فردا هنوز قطعی نشده و پیامک نرفته است. برای قطعی‌کردن کلیک کنید.</span>
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="نوبت‌های امروز" value={toPersianDigits(d.todayAppointments.length)} icon={<CalendarDays className="h-6 w-6" />} hint={`فردا: ${toPersianDigits(d.tomorrowAppts)} نوبت`} />
        <Stat label="بیماران فعال" value={toPersianDigits(d.patientsActive)} icon={<Users className="h-6 w-6" />} tone="sage" hint={`${toPersianDigits(d.newPatientsMonth)} بیمار جدید این ماه`} />
        <Stat label="لیدهای جدید" value={toPersianDigits(d.newLeads)} icon={<UserPlus className="h-6 w-6" />} tone="amber" hint={d.leadsFollowUp ? `${toPersianDigits(d.leadsFollowUp)} لید نیازمند پیگیری` : "پیگیری معوقه ندارید"} />
        <Stat label="درآمد ۳۰ روز اخیر" value={formatMoney(d.incomeMonth)} icon={<Wallet className="h-6 w-6" />} tone="coral" hint={`بدهی کل بیماران: ${formatMoney(d.totalDebt)} (${toPersianDigits(d.debtorsCount)} نفر)`} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card title="برنامه امروز" subtitle={`${toPersianDigits(d.todayAppointments.length)} نوبت`} className="lg:col-span-2" actions={<Link href="/panel/schedule" className="text-xs text-brand-600 hover:underline">مشاهده کامل</Link>}>
          {d.todayAppointments.length ? <ul className="divide-y divide-sand-100">{d.todayAppointments.map((a: any) => <AppointmentRow key={a.id} a={a} />)}</ul> : <EmptyState title="امروز نوبتی ثبت نشده" icon={<CalendarDays className="h-6 w-6" />} />}
        </Card>
        <div className="space-y-5">
          <Card title="تولدهای نزدیک" actions={<Link href="/panel/crm/birthdays" className="text-xs text-brand-600 hover:underline">همه</Link>}>
            {d.birthdays.length ? (
              <ul className="space-y-2">
                {d.birthdays.slice(0, 5).map((p: any) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-coral-100 text-coral-600"><Cake className="h-4 w-4" /></span>
                    <Link href={`/panel/patients/${p.id}`} className="flex-1 hover:text-brand-700">{p.firstName} {p.lastName}</Link>
                    <Badge tone={p.daysToBirthday === 0 ? "coral" : "amber"}>{p.daysToBirthday === 0 ? "امروز!" : `${toPersianDigits(p.daysToBirthday)} روز دیگر`}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">تولدی در هفته آینده نیست</p>}
          </Card>
          <Card title="کارهای در انتظار">
            <ul className="space-y-2 text-sm">
              <li><Link href="/panel/feedback?status=OPEN" className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-sand-100"><span className="flex items-center gap-2"><MessageSquareHeart className="h-4 w-4 text-coral-500" />بازخورد بی‌پاسخ</span><b className="num">{toPersianDigits(d.openFeedback)}</b></Link></li>
              <li><Link href="/panel/leads?followUpDue=1" className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-sand-100"><span className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-amber-500" />لید نیازمند پیگیری</span><b className="num">{toPersianDigits(d.leadsFollowUp)}</b></Link></li>
              <li><Link href="/panel/sms?tab=logs" className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-sand-100"><span className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-brand-500" />پیامک‌های امروز</span><b className="num">{toPersianDigits(d.smsToday)}</b></Link></li>
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="جلسات انجام‌شده (۱۴ روز اخیر)">
          <div className="h-56" dir="ltr">
            <ResponsiveContainer>
              <BarChart data={d.series.map((s: any) => ({ ...s, label: formatJalali(s.date).slice(5) }))}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                <Tooltip contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12, direction: "rtl" }} formatter={(v: any) => [toPersianDigits(v), "جلسه"]} />
                <Bar dataKey="sessions" fill="#0f8b8d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="درآمد روزانه (۱۴ روز اخیر)">
          <div className="h-56" dir="ltr">
            <ResponsiveContainer>
              <AreaChart data={d.series.map((s: any) => ({ ...s, label: formatJalali(s.date).slice(5) }))}>
                <defs><linearGradient id="inc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e76f51" stopOpacity={0.5} /><stop offset="1" stopColor="#e76f51" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} />
                <YAxis tick={{ fontSize: 10 }} width={40} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12, direction: "rtl" }} formatter={(v: any) => [formatMoney(v), "درآمد"]} />
                <Area dataKey="income" stroke="#e76f51" fill="url(#inc)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  );
}

function TherapistDashboard({ d }: { d: any }) {
  return (
    <>
      <PageHeader title={<Greeting />} subtitle={formatJalaliLong(new Date(), true)} actions={!d.dailyLogged && <Link href="/panel/forms/daily" className="btn-accent"><ClipboardList className="h-4 w-4" />ثبت عملکرد امروز</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="جلسات امروز" value={toPersianDigits(d.todayAppointments.length)} icon={<CalendarDays className="h-6 w-6" />} />
        <Stat label="جلسات این هفته" value={toPersianDigits(d.weekCount)} icon={<CalendarCheck className="h-6 w-6" />} tone="amber" />
        <Stat label="بیماران فعال من" value={toPersianDigits(d.patientsCount)} icon={<Users className="h-6 w-6" />} tone="sage" />
        <Stat label="جلسات انجام‌شده (۳۰ روز)" value={toPersianDigits(d.doneMonth)} icon={<TrendingUp className="h-6 w-6" />} tone="violet" />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card title="برنامه امروز من" className="lg:col-span-2" actions={<Link href="/panel/schedule" className="text-xs text-brand-600 hover:underline">تقویم</Link>}>
          {d.todayAppointments.length ? <ul className="divide-y divide-sand-100">{d.todayAppointments.map((a: any) => <AppointmentRow key={a.id} a={a} showTherapist={false} />)}</ul> : <EmptyState title="امروز جلسه‌ای ندارید" icon={<CalendarDays className="h-6 w-6" />} />}
        </Card>
        <Card title="جلسات بدون گزارش" subtitle="جلسات گذشته‌ای که هنوز گزارش پیشرفت ندارند">
          {d.pendingSessions.length ? (
            <ul className="space-y-2">
              {d.pendingSessions.map((a: any) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span>{a.patientName}<span className="mr-2 text-xs text-slate-400">{formatJalali(a.startAt)}</span></span>
                  <Link href={`/panel/forms/progress/new?patientId=${a.patientId}&appointmentId=${a.id}`} className="text-xs text-brand-600 hover:underline">ثبت گزارش</Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">همه جلسات گزارش دارند 👌</p>}
        </Card>
      </div>
      <Card title="آخرین گزارش‌های من" className="mt-5">
        {d.recentNotes.length ? (
          <ul className="divide-y divide-sand-100">
            {d.recentNotes.map((n: any) => (
              <li key={n.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/panel/forms/progress/${n.id}`} className="hover:text-brand-700">{n.patient.firstName} {n.patient.lastName} <span className="text-xs text-slate-400">({n.patient.fileNumber})</span></Link>
                <span className="text-xs text-slate-400">{formatJalali(n.date)} · جلسه {toPersianDigits(n.sessionNumber)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-400">هنوز گزارشی ثبت نکرده‌اید</p>}
      </Card>
    </>
  );
}

function PatientDashboard({ d }: { d: any }) {
  const next = d.upcoming[0];
  const fin = d.finance;
  return (
    <>
      <PageHeader title={<Greeting />} subtitle={`شماره پرونده: ${d.patient.fileNumber}${d.patient.primaryTherapist ? ` · درمانگر: ${d.patient.primaryTherapist.user.firstName} ${d.patient.primaryTherapist.user.lastName}` : ""}`} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-card lg:col-span-2">
          <p className="text-sm text-brand-100">جلسه بعدی شما</p>
          {next ? (
            <>
              <p className="mt-2 text-2xl font-black">{formatJalaliLong(next.startAt, true)}</p>
              <p className="num mt-1 text-lg">ساعت {formatTime(next.startAt)} با {next.therapistName}</p>
              <div className="mt-4 flex items-center gap-2 text-sm"><StatusBadge status={next.status} /><span className="text-brand-100">{next.status === "CONFIRMED" ? "این نوبت قطعی است؛ ۲ ساعت قبل یادآوری می‌شود" : "منتظر قطعی‌شدن توسط کلینیک"}</span></div>
            </>
          ) : <p className="mt-2 text-lg">نوبت آینده‌ای ثبت نشده است. برای رزرو با کلینیک تماس بگیرید.</p>}
          <Link href="/panel/my/schedule" className="mt-5 inline-flex items-center gap-1 text-sm text-white/90 hover:underline">همه جلسات<ArrowLeft className="h-4 w-4" /></Link>
        </div>
        <Card title="وضعیت مالی" actions={<Link href="/panel/my/finance" className="text-xs text-brand-600 hover:underline">جزئیات</Link>}>
          <p className="text-xs text-slate-400">{fin.balance > 0 ? "مانده بدهی" : fin.balance < 0 ? "بستانکاری شما" : "وضعیت"}</p>
          <p className={`num text-2xl font-black ${fin.balance > 0 ? "text-coral-600" : "text-sage-700"}`}>{fin.balance === 0 ? "تسویه‌شده ✅" : formatMoney(Math.abs(fin.balance))}</p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-sand-100 px-3 py-2 text-sm"><span className="text-slate-500">کیف پول</span><b className="num text-brand-700">{formatMoney(fin.walletBalance)}</b></div>
          {fin.nextDueDate && fin.balance > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3.5 w-3.5" />مهلت پرداخت: {formatJalali(fin.nextDueDate)}</p>}
        </Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="اهداف درمانی" actions={<Link href="/panel/my/records?tab=goals" className="text-xs text-brand-600 hover:underline">همه</Link>}>
          {d.goals.length ? d.goals.map((g: any) => (
            <div key={g.id} className="mb-3">
              <div className="mb-1 flex justify-between text-sm"><span className="flex items-center gap-1.5"><Target className="h-4 w-4 text-brand-500" />{g.title}</span><span className="num text-xs text-slate-400">{toPersianDigits(g.progress)}٪</span></div>
              <ProgressBar value={g.progress} />
            </div>
          )) : <p className="text-sm text-slate-400">هنوز هدفی ثبت نشده</p>}
        </Card>
        <Card title="خلاصه درمان">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-brand-50 p-3"><p className="num text-2xl font-black text-brand-700">{toPersianDigits(d.sessionsDone)}</p><p className="text-xs text-slate-500">جلسه انجام‌شده</p></div>
            <div className="rounded-2xl bg-coral-50 p-3"><p className="num text-2xl font-black text-coral-600">{toPersianDigits(d.homePrograms)}</p><p className="text-xs text-slate-500">تمرین خانگی فعال</p></div>
          </div>
          <Link href="/panel/my/home" className="btn-secondary mt-4 w-full"><Dumbbell className="h-4 w-4" />تمرین‌های امروز</Link>
        </Card>
        <Card title="آخرین گزارش‌ها" actions={<Link href="/panel/my/records" className="text-xs text-brand-600 hover:underline">پرونده</Link>}>
          {d.recentProgress.length ? (
            <ul className="space-y-3">
              {d.recentProgress.map((n: any) => (
                <li key={n.id} className="text-sm">
                  <p className="text-xs text-slate-400">{formatJalali(n.date)} · {n.therapist.user.firstName} {n.therapist.user.lastName}</p>
                  <p className="line-clamp-2 leading-6">{n.assessment || n.objective || n.activities}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">گزارشی ثبت نشده</p>}
        </Card>
      </div>
    </>
  );
}

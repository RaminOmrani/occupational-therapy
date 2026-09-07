"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, ChevronLeft, ChevronRight, Check, User, Clock } from "lucide-react";
import { addDays, startOfDay, formatJalaliLong, formatTime, toPersianDigits, WEEKDAYS_FA, toJalali, JALALI_MONTHS } from "@toranj/shared";
import { api } from "@/lib/api";
import { Avatar, Button, Field, Input, Spinner, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

export function BookingWizard({ phone }: { phone: string }) {
  const { data: cfg, isLoading } = useQuery({ queryKey: ["booking-config"], queryFn: () => api.get<any>("/public/booking/config") });
  const [therapistId, setTherapistId] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const therapist = cfg?.therapists.find((t: any) => t.id === therapistId);
  const days = useMemo(() => Array.from({ length: cfg?.daysAhead ?? 14 }, (_, i) => addDays(startOfDay(new Date()), i)), [cfg]);
  const slots = useQuery({ queryKey: ["slots", therapistId, date?.toISOString()], queryFn: () => api.get<{ slots: string[]; offDay?: boolean }>("/public/booking/slots", { therapistId, date: date!.toISOString() }), enabled: !!therapistId && !!date });
  useEffect(() => setSlot(null), [therapistId, date]);

  if (isLoading) return <Spinner />;
  if (!cfg?.enabled) return <div className="card p-8 text-center text-slate-500">نوبت‌دهی آنلاین در حال حاضر غیرفعال است. لطفاً با <span className="num" dir="ltr">{toPersianDigits(phone)}</span> تماس بگیرید.</div>;
  if (done) return <div className="card p-10 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage-100 text-sage-700"><Check className="h-8 w-8" /></div><h2 className="mt-4 text-xl font-black">درخواست شما ثبت شد</h2><p className="mt-2 text-slate-500">{formatJalaliLong(slot!, true)} ساعت {formatTime(slot!)} با {therapist?.fullName}</p><p className="mt-2 text-sm text-slate-400">پس از بررسی و تأیید کلینیک، پیامک تأیید برای شما ارسال می‌شود.</p></div>;

  const submit = async () => {
    if (!form.firstName || !form.lastName || !form.phone) return toast.error("نام، نام خانوادگی و شماره موبایل الزامی است");
    setLoading(true);
    try { await api.post("/public/booking", { therapistId, startAt: slot, ...form }); setDone(true); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const step = !therapistId ? 1 : !slot ? 2 : 3;
  const Step = ({ n, label }: { n: number; label: string }) => <div className={cn("flex items-center gap-2 text-sm", step >= n ? "text-brand-700" : "text-slate-400")}><span className={cn("num grid h-7 w-7 place-items-center rounded-full text-xs font-bold", step > n ? "bg-sage-500 text-white" : step === n ? "bg-brand-600 text-white" : "bg-sand-200")}>{step > n ? <Check className="h-4 w-4" /> : toPersianDigits(n)}</span>{label}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-6"><Step n={1} label="انتخاب درمانگر" /><ChevronLeft className="h-4 w-4 text-slate-300" /><Step n={2} label="انتخاب زمان" /><ChevronLeft className="h-4 w-4 text-slate-300" /><Step n={3} label="اطلاعات شما" /></div>

      <div className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold"><User className="h-4 w-4 text-brand-600" />درمانگر</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {cfg.therapists.map((t: any) => (
            <button key={t.id} type="button" onClick={() => setTherapistId(t.id)} className={cn("flex items-center gap-3 rounded-2xl border p-3 text-right transition", therapistId === t.id ? "border-brand-600 bg-brand-50" : "border-sand-200 hover:border-brand-300")}>
              <Avatar name={t.fullName} />
              <div><p className="font-bold">{t.fullName}</p><p className="text-xs text-slate-500">{t.specialty}</p><p className="text-[11px] text-slate-400">روزهای کاری: {[6, 0, 1, 2, 3, 4, 5].filter((d) => t.workDays.includes(d)).map((d) => WEEKDAYS_FA[d]).join("، ")}</p></div>
            </button>
          ))}
        </div>
      </div>

      {therapistId && (
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-bold"><CalendarCheck className="h-4 w-4 text-brand-600" />تاریخ</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {days.map((d) => { const off = !therapist.workDays.includes(d.getDay()); const j = toJalali(d); const active = date?.getTime() === d.getTime(); return (
              <button key={d.toISOString()} type="button" disabled={off} onClick={() => setDate(d)} className={cn("flex w-20 shrink-0 flex-col items-center rounded-2xl border px-2 py-2.5 text-xs transition disabled:opacity-40", active ? "border-brand-600 bg-brand-600 text-white" : "border-sand-200 bg-white hover:border-brand-300")}>
                <span>{WEEKDAYS_FA[d.getDay()]}</span><span className="num text-xl font-black">{toPersianDigits(j.jd)}</span><span>{JALALI_MONTHS[j.jm - 1]}</span>
              </button>); })}
          </div>
          {date && (
            <div className="mt-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold"><Clock className="h-4 w-4 text-brand-600" />ساعت‌های خالی {formatJalaliLong(date, true)}</h4>
              {slots.isLoading ? <Spinner className="py-4" /> : slots.data?.slots.length ? (
                <div className="flex flex-wrap gap-2">{slots.data.slots.map((s) => <button key={s} type="button" onClick={() => setSlot(s)} className={cn("num rounded-xl border px-3 py-2 text-sm transition", slot === s ? "border-brand-600 bg-brand-600 text-white" : "border-sand-300 bg-white hover:border-brand-300")}>{formatTime(s)}</button>)}</div>
              ) : <p className="text-sm text-slate-400">در این روز زمان خالی نیست؛ روز دیگری را انتخاب کنید.</p>}
            </div>
          )}
        </div>
      )}

      {slot && (
        <div className="card p-5">
          <h3 className="mb-1 font-bold">اطلاعات شما</h3>
          <p className="mb-4 text-sm text-slate-500">{formatJalaliLong(slot, true)} ساعت {formatTime(slot)} با {therapist.fullName}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام" required><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="نام خانوادگی" required><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
            <Field label="شماره موبایل" required hint="اگر قبلاً پرونده دارید، همان شماره را وارد کنید"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" className="num text-left" placeholder="09123456789" /></Field>
            <Field label="توضیح (اختیاری)"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="مثلاً: کودک ۵ ساله، تأخیر حرکتی" /></Field>
          </div>
          <Button className="mt-4 w-full" size="lg" loading={loading} onClick={submit} icon={<CalendarCheck className="h-5 w-5" />}>ثبت درخواست نوبت</Button>
        </div>
      )}
    </div>
  );
}

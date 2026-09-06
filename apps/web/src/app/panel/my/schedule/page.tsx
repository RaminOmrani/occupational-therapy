"use client";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Clock, MapPin } from "lucide-react";
import { formatJalaliLong, formatTime, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePublicSettings } from "@/lib/settings";

export default function MySchedulePage() {
  const { user } = useAuth();
  const s = usePublicSettings();
  const { data, isLoading } = useQuery({ queryKey: ["my-appointments"], queryFn: () => api.get<{ items: any[] }>("/appointments/mine") });
  const past = useQuery({ queryKey: ["my-appointments-past"], queryFn: () => api.get<{ items: any[] }>("/appointments", { from: new Date(Date.now() - 90 * 86400000).toISOString(), to: new Date().toISOString() }) });
  return (
    <>
      <PageHeader title="برنامه جلسات" subtitle={`یادآوری پیامکی ${toPersianDigits(s.num("schedule.reminderHoursBefore", 2))} ساعت قبل از هر جلسه قطعی ارسال می‌شود`} icon={<CalendarCheck className="h-5 w-5" />} />
      {isLoading ? <Spinner /> : data?.items.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((a, i) => (
            <Card key={a.id} className={i === 0 ? "border-brand-300 bg-gradient-to-br from-brand-50 to-white" : ""}>
              {i === 0 && <p className="mb-2 text-xs font-bold text-brand-700">جلسه بعدی</p>}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{formatJalaliLong(a.startAt, true)}</p>
                  <p className="num mt-1 flex items-center gap-1 text-sm text-slate-600"><Clock className="h-3.5 w-3.5" />{formatTime(a.startAt)} تا {formatTime(a.endAt)}</p>
                  <p className="mt-1 text-sm text-slate-500">با {a.therapistName}{a.room ? <span className="mr-2 inline-flex items-center gap-1 text-xs"><MapPin className="h-3 w-3" />{a.room}</span> : null}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              {a.status === "SCHEDULED" && <p className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-600">این نوبت هنوز توسط کلینیک قطعی نشده است.</p>}
            </Card>
          ))}
        </div>
      ) : <EmptyState title="نوبت آینده‌ای ندارید" description={`برای رزرو با شماره ${toPersianDigits(s.str("clinic.phone"))} تماس بگیرید`} icon={<CalendarCheck className="h-6 w-6" />} />}
      {past.data?.items.length ? (
        <Card title="جلسات گذشته (۹۰ روز اخیر)" className="mt-6" padded={false}>
          <table className="table"><thead><tr><th>تاریخ</th><th>ساعت</th><th>درمانگر</th><th>وضعیت</th></tr></thead><tbody>{past.data.items.slice().reverse().map((a) => <tr key={a.id}><td className="num">{formatJalaliLong(a.startAt)}</td><td className="num">{formatTime(a.startAt)}</td><td>{a.therapistName}</td><td><StatusBadge status={a.status} /></td></tr>)}</tbody></table>
        </Card>
      ) : null}
    </>
  );
}

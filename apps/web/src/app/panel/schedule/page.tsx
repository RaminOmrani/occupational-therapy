"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, CalendarPlus, CheckCheck, Copy, LayoutGrid, List, Lock, Phone } from "lucide-react";
import { addDays, formatJalaliLong, formatTime, startOfDay, endOfDay, toPersianDigits, WEEKDAYS_FA } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/hooks";
import { usePublicSettings } from "@/lib/settings";
import { Button, Card, EmptyState, Modal, PageHeader, Select, Spinner, Field, Badge } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { AppointmentModal } from "@/components/schedule/AppointmentModal";
import { cn } from "@/lib/utils";

function Inner() {
  const sp = useSearchParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const settings = usePublicSettings();
  const startHour = settings.num("schedule.startHour", 8);
  const endHour = settings.num("schedule.endHour", 20);
  const [date, setDate] = useState(() => addDays(startOfDay(new Date()), Number(sp.get("day") ?? 0)));
  const [therapistId, setTherapistId] = useState(user?.role === "THERAPIST" ? user.therapistId ?? "" : "");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [modal, setModal] = useState<any | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const { data: therapists } = useTherapists();
  const { data, isLoading } = useQuery({ queryKey: ["appointments", date.toISOString(), therapistId], queryFn: () => api.get<{ items: any[] }>("/appointments", { from: startOfDay(date).toISOString(), to: endOfDay(date).toISOString(), therapistId }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const canManage = user?.role === "ADMIN" || user?.role === "SECRETARY";
  const cols = useMemo(() => (therapists?.items ?? []).filter((t) => t.isActive && (!therapistId || t.id === therapistId)), [therapists, therapistId]);
  const items = data?.items ?? [];
  const unfixed = items.filter((a) => a.status === "SCHEDULED").length;
  const isPast = endOfDay(date) < new Date();

  const fixDay = async (resend = false) => {
    try {
      const r = await api.post<{ confirmed: number; smsSent: number }>("/appointments/fix-day", { date: date.toISOString(), therapistId: therapistId || undefined, resend });
      toast.success(`${toPersianDigits(r.confirmed)} نوبت قطعی شد و ${toPersianDigits(r.smsSent)} پیامک ارسال شد`);
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };
  const setStatus = async (a: any, status: string) => { try { await api.patch(`/appointments/${a.id}`, { status }); refresh(); } catch (e: any) { toast.error(e.message); } };

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const HOUR_H = 88; // px per hour
  const pos = (a: any) => { const s = new Date(a.startAt); const e = new Date(a.endAt); const top = ((s.getHours() + s.getMinutes() / 60 - startHour) * HOUR_H); const h = Math.max(28, ((e.getTime() - s.getTime()) / 3600000) * HOUR_H); return { top, height: h }; };

  return (
    <>
      <PageHeader title="برنامه روزانه" subtitle={isPast ? "روز گذشته" : unfixed ? `${toPersianDigits(unfixed)} نوبت هنوز قطعی نشده` : items.length ? "همه نوبت‌ها قطعی شده ✅" : "برای این روز نوبتی ثبت نشده"} actions={<>
        <div className="flex rounded-xl bg-sand-200 p-0.5"><button onClick={() => setView("grid")} className={cn("rounded-lg p-1.5", view === "grid" && "bg-white shadow-soft")}><LayoutGrid className="h-4 w-4" /></button><button onClick={() => setView("list")} className={cn("rounded-lg p-1.5", view === "list" && "bg-white shadow-soft")}><List className="h-4 w-4" /></button></div>
        {canManage && <Button variant="secondary" onClick={() => setCopyOpen(true)} icon={<Copy className="h-4 w-4" />}>کپی برنامه</Button>}
        {canManage && items.length > 0 && !isPast && <Button variant={unfixed ? "accent" : "secondary"} onClick={() => fixDay(false)} icon={<Lock className="h-4 w-4" />}>{unfixed ? "قطعی‌کردن و ارسال پیامک" : "ارسال مجدد پیامک"}</Button>}
        <Button onClick={() => setModal({ startAt: (() => { const d = new Date(date); d.setHours(Math.max(startHour, new Date().getHours() + 1), 0, 0, 0); return d; })(), therapistId: therapistId || undefined })} icon={<CalendarPlus className="h-4 w-4" />}>نوبت جدید</Button>
      </>} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setDate(addDays(date, -1))} className="rounded-xl p-2 hover:bg-sand-200"><ChevronRight className="h-5 w-5" /></button>
            <button onClick={() => setDate(startOfDay(new Date()))} className="rounded-xl px-3 py-1.5 text-sm hover:bg-sand-200">امروز</button>
            <button onClick={() => setDate(addDays(date, 1))} className="rounded-xl p-2 hover:bg-sand-200"><ChevronLeft className="h-5 w-5" /></button>
          </div>
          <JalaliDatePicker value={date} onChange={(d) => d && setDate(startOfDay(d))} className="w-40" />
          <span className="text-sm font-bold text-brand-800">{formatJalaliLong(date, true)}</span>
          {user?.role !== "THERAPIST" && <Select value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className="w-48"><option value="">همه درمانگران</option>{therapists?.items.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select>}
          <div className="mr-auto flex items-center gap-2 text-xs text-slate-500"><Badge tone="amber">{toPersianDigits(unfixed)} برنامه‌ریزی‌شده</Badge><Badge tone="brand">{toPersianDigits(items.filter((a) => a.status === "CONFIRMED").length)} قطعی</Badge><Badge tone="sage">{toPersianDigits(items.filter((a) => a.status === "DONE").length)} انجام‌شده</Badge></div>
          <div className="hidden w-full gap-1 text-xs text-slate-400 md:flex">{[0, 1, 2, 3, 4, 5, 6].map((i) => { const d = addDays(startOfDay(new Date()), i); const active = d.getTime() === date.getTime(); return <button key={i} onClick={() => setDate(d)} className={cn("rounded-lg px-2 py-1", active ? "bg-brand-600 text-white" : "hover:bg-sand-200")}>{WEEKDAYS_FA[d.getDay()]} {toPersianDigits(d.getDate() === new Date().getDate() && i === 0 ? "(امروز)" : "")}</button>; })}</div>
        </div>
      </Card>

      {isLoading ? <Spinner /> : view === "grid" ? (
        <Card padded={false} className="overflow-x-auto">
          <div className="min-w-[640px]" style={{ minWidth: `${140 + cols.length * 200}px` }}>
            <div className="sticky top-0 z-10 grid border-b border-sand-200 bg-sand-50" style={{ gridTemplateColumns: `64px repeat(${cols.length}, minmax(180px, 1fr))` }}>
              <div />
              {cols.map((t) => <div key={t.id} className="border-r border-sand-200 px-3 py-2.5 text-sm font-bold" style={{ borderTop: `3px solid ${t.color}` }}>{t.fullName}<span className="mr-2 text-xs font-normal text-slate-400 num">{toPersianDigits(items.filter((a) => a.therapistId === t.id && a.status !== "CANCELLED").length)}</span></div>)}
            </div>
            <div className="grid pt-3" style={{ gridTemplateColumns: `64px repeat(${cols.length}, minmax(180px, 1fr))` }}>
              <div className="relative" style={{ height: hours.length * HOUR_H }}>
                {hours.map((h, i) => <div key={h} className="num absolute right-0 w-full pr-2 text-xs text-slate-400" style={{ top: i * HOUR_H - 7 }}>{toPersianDigits(String(h).padStart(2, "0"))}:۰۰</div>)}
              </div>
              {cols.map((t) => (
                <div key={t.id} className="relative border-r border-sand-200" style={{ height: hours.length * HOUR_H }}>
                  {hours.map((h, i) => (
                    <div key={h} className="absolute inset-x-0 border-t border-sand-200/80" style={{ top: i * HOUR_H, height: HOUR_H }}>
                      {[0, 1].map((half) => (
                        <button key={half} type="button" title="افزودن نوبت" onClick={() => { const d = new Date(date); d.setHours(h, half * 30, 0, 0); setModal({ startAt: d, therapistId: t.id }); }} className={cn("absolute inset-x-0 h-1/2 transition hover:bg-brand-50/70", half === 1 && "top-1/2 border-t border-dashed border-sand-200/60")} />
                      ))}
                    </div>
                  ))}
                  {items.filter((a) => a.therapistId === t.id).map((a) => {
                    const { top, height } = pos(a);
                    const cancelled = a.status === "CANCELLED" || a.status === "NO_SHOW";
                    return (
                      <button key={a.id} type="button" onClick={() => setModal({ ...a, patientLabel: `${a.patientName} (${a.patient.fileNumber})`, durationMin: Math.round((new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000) })}
                        className={cn("absolute inset-x-1 overflow-hidden rounded-xl border-r-4 px-2 py-1 text-right text-xs shadow-soft transition hover:shadow-card", cancelled ? "bg-sand-100 text-slate-400 line-through" : a.status === "DONE" ? "bg-sage-100 text-sage-700" : a.status === "CONFIRMED" ? "bg-white text-slate-800" : "bg-amber-400/15 text-amber-700")}
                        style={{ top, height, borderColor: t.color }}>
                        <p className="truncate font-bold">{a.patientName}</p>
                        <p className="num">{formatTime(a.startAt)} - {formatTime(a.endAt)}{a.room ? ` · ${a.room}` : ""}</p>
                        {height > 50 && <p className="mt-0.5"><StatusBadge status={a.status} /></p>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {cols.map((t) => {
            const list = items.filter((a) => a.therapistId === t.id);
            return (
              <Card key={t.id} title={<span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: t.color }} />{t.fullName}</span>} subtitle={`${toPersianDigits(list.length)} نوبت`} padded={false}>
                {list.length ? (
                  <ul className="divide-y divide-sand-100">
                    {list.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <span className="num w-24 text-sm font-bold text-brand-700">{formatTime(a.startAt)} - {formatTime(a.endAt)}</span>
                        <button onClick={() => setModal({ ...a, patientLabel: `${a.patientName} (${a.patient.fileNumber})`, durationMin: Math.round((new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000) })} className="flex-1 text-right text-sm font-medium hover:text-brand-700">{a.patientName}<span className="mr-2 text-xs text-slate-400 num">{a.patient.fileNumber}</span></button>
                        <a href={`tel:${a.patient.phone}`} className="num text-xs text-slate-400" dir="ltr"><Phone className="inline h-3 w-3" /> {toPersianDigits(a.patient.phone)}</a>
                        <StatusBadge status={a.status} />
                        {a.status !== "DONE" && a.status !== "CANCELLED" && new Date(a.startAt) < new Date() && (
                          <div className="flex gap-1">
                            <button onClick={() => setStatus(a, "DONE")} className="rounded-lg bg-sage-100 px-2 py-1 text-xs text-sage-700 hover:bg-sage-300">انجام شد</button>
                            <button onClick={() => setStatus(a, "NO_SHOW")} className="rounded-lg bg-coral-100 px-2 py-1 text-xs text-coral-700 hover:bg-coral-200">غیبت</button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-5 py-6 text-sm text-slate-400">نوبتی ندارد</p>}
              </Card>
            );
          })}
          {!cols.length && <EmptyState title="درمانگری تعریف نشده" />}
        </div>
      )}

      {modal && <AppointmentModal open onClose={() => setModal(null)} initial={modal} onSaved={() => { setModal(null); refresh(); }} />}
      {copyOpen && <CopyDayModal date={date} therapistId={therapistId} onClose={() => setCopyOpen(false)} onDone={() => { setCopyOpen(false); refresh(); }} />}
    </>
  );
}

function CopyDayModal({ date, therapistId, onClose, onDone }: { date: Date; therapistId: string; onClose: () => void; onDone: () => void }) {
  const [from, setFrom] = useState<Date | null>(addDays(date, -7));
  const [loading, setLoading] = useState(false);
  const run = async () => {
    if (!from) return;
    setLoading(true);
    try { const r = await api.post<{ created: number; skipped: number }>("/appointments/copy-day", { from: from.toISOString(), to: date.toISOString(), therapistId: therapistId || undefined }); toast.success(`${toPersianDigits(r.created)} نوبت کپی شد${r.skipped ? `؛ ${toPersianDigits(r.skipped)} مورد به‌دلیل تداخل رد شد` : ""}`); onDone(); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="کپی برنامه از روز دیگر" size="sm" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={run} icon={<CheckCheck className="h-4 w-4" />}>کپی به {formatJalaliLong(date)}</Button></>}>
      <p className="mb-3 text-sm text-slate-500">برای بیمارانی که برنامه هفتگی ثابت دارند، نوبت‌های یک روز (مثلاً هفته قبل) را به این روز کپی کنید. نوبت‌ها با وضعیت «برنامه‌ریزی‌شده» ساخته می‌شوند تا پس از بازبینی قطعی کنید.</p>
      <Field label="کپی از تاریخ"><JalaliDatePicker value={from} onChange={setFrom} /></Field>
    </Modal>
  );
}

export default function SchedulePage() {
  return <Suspense><Inner /></Suspense>;
}

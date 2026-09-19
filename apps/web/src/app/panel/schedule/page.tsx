"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, CalendarPlus, CheckCheck, Copy, LayoutGrid, List, Lock, Phone, Maximize2, ZoomIn, ZoomOut, Pencil, Banknote, ReceiptText, Search, X } from "lucide-react";
import { addDays, formatJalaliLong, formatTime, startOfDay, endOfDay, toPersianDigits, toEnglishDigits, WEEKDAYS_FA } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/hooks";
import { usePublicSettings } from "@/lib/settings";
import { Button, Card, EmptyState, Modal, PageHeader, Select, Spinner, Field, Badge } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { AppointmentModal } from "@/components/schedule/AppointmentModal";
import { SettleModal } from "@/components/schedule/SettleModal";
import { cn } from "@/lib/utils";

type View = "fit" | "grid" | "list";

function Inner() {
  const sp = useSearchParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const settings = usePublicSettings();
  const startHour = settings.num("schedule.startHour", 8);
  const endHour = settings.num("schedule.endHour", 22);
  const [date, setDate] = useState(() => (sp.get("date") ? startOfDay(new Date(sp.get("date")!)) : addDays(startOfDay(new Date()), Number(sp.get("day") ?? 0))));
  const [therapistId, setTherapistId] = useState(user?.role === "THERAPIST" ? user.therapistId ?? "" : "");
  const [view, setView] = useState<View>("grid");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<any | null>(null);
  const [actions, setActions] = useState<any | null>(null);
  const [settle, setSettle] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const { data: therapists } = useTherapists();
  const { data, isLoading } = useQuery({ queryKey: ["appointments", date.toISOString(), therapistId], queryFn: () => api.get<{ items: any[] }>("/appointments", { from: startOfDay(date).toISOString(), to: endOfDay(date).toISOString(), therapistId }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const canManage = user?.role === "ADMIN" || user?.role === "SECRETARY";
  const cols = useMemo(() => (therapists?.items ?? []).filter((t) => t.isActive && (!therapistId || t.id === therapistId)), [therapists, therapistId]);
  const items = data?.items ?? [];
  const unfixed = items.filter((a) => a.status === "SCHEDULED").length;
  const isPast = endOfDay(date) < new Date();

  // روی موبایل به‌صورت پیش‌فرض نمای «تمام‌صفحه» (کل برنامه در یک صفحه بدون اسکرول) نشان داده می‌شود
  useEffect(() => { try { const saved = localStorage.getItem("schedule-view") as View | null; if (saved) setView(saved); else if (window.innerWidth < 768) setView("fit"); } catch {} }, []);
  const changeView = (v: View) => { setView(v); try { localStorage.setItem("schedule-view", v); } catch {} };

  // جستجو: نام مراجع، شماره پرونده یا موبایل
  const needle = toEnglishDigits(q.trim()).toLowerCase();
  const matches = (a: any) => !needle || `${a.patientName} ${a.patient.fileNumber} ${a.patient.phone} ${a.therapistName ?? ""}`.toLowerCase().includes(needle);
  const matchCount = needle ? items.filter(matches).length : 0;

  const fixDay = async (resend = false) => {
    try {
      const r = await api.post<{ confirmed: number; smsSent: number }>("/appointments/fix-day", { date: date.toISOString(), therapistId: therapistId || undefined, resend });
      toast.success(`${toPersianDigits(r.confirmed)} نوبت قطعی شد و ${toPersianDigits(r.smsSent)} پیامک ارسال شد`);
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };
  const setStatus = async (a: any, status: string) => { try { await api.patch(`/appointments/${a.id}`, { status }); refresh(); } catch (e: any) { toast.error(e.message); } };
  const openEdit = (a: any) => setModal({ ...a, patientLabel: `${a.patientName} (${a.patient.fileNumber})`, durationMin: Math.round((new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000) });

  const hours = Array.from({ length: Math.max(1, endHour - startHour) }, (_, i) => startHour + i);
  const blockClass = (a: any) => { const cancelled = a.status === "CANCELLED" || a.status === "NO_SHOW"; return cn(cancelled ? "bg-sand-100 text-slate-400 line-through" : a.status === "DONE" ? "bg-sage-100 text-sage-700" : a.status === "CONFIRMED" ? "bg-white text-slate-800" : "bg-amber-400/15 text-amber-700", needle && (matches(a) ? "ring-2 ring-coral-500" : "opacity-25")); };

  /** نمای شبکه‌ای؛ با پارامترهای اندازه برای حالت عادی و فشرده */
  const Grid = ({ hourH, colW, labelW, compact }: { hourH: number; colW: number; labelW: number; compact?: boolean }) => {
    const pos = (a: any) => { const s = new Date(a.startAt); const e = new Date(a.endAt); const top = (s.getHours() + s.getMinutes() / 60 - startHour) * hourH; const h = Math.max(compact ? 18 : 28, ((e.getTime() - s.getTime()) / 3600000) * hourH); return { top, height: h }; };
    return (
      <div style={{ width: labelW + cols.length * colW }}>
        <div className="sticky top-0 z-10 grid border-b border-sand-200 bg-sand-50" style={{ gridTemplateColumns: `${labelW}px repeat(${cols.length}, ${colW}px)` }}>
          <div />
          {cols.map((t) => <div key={t.id} className={cn("truncate border-r border-sand-200 font-bold", compact ? "px-1.5 py-1 text-[11px]" : "px-3 py-2.5 text-sm")} style={{ borderTop: `3px solid ${t.color}` }}>{t.fullName}<span className="mr-1.5 text-[10px] font-normal text-slate-400 num">{toPersianDigits(items.filter((a) => a.therapistId === t.id && a.status !== "CANCELLED").length)}</span></div>)}
        </div>
        <div className="grid pt-2" style={{ gridTemplateColumns: `${labelW}px repeat(${cols.length}, ${colW}px)` }}>
          <div className="relative" style={{ height: hours.length * hourH }}>
            {hours.map((h, i) => <div key={h} className={cn("num absolute right-0 w-full pr-1 text-slate-400", compact ? "text-[10px]" : "text-xs")} style={{ top: i * hourH - 7 }}>{toPersianDigits(String(h).padStart(2, "0"))}{compact ? "" : ":۰۰"}</div>)}
          </div>
          {cols.map((t) => (
            <div key={t.id} className="relative border-r border-sand-200" style={{ height: hours.length * hourH }}>
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-sand-200/80" style={{ top: i * hourH, height: hourH }}>
                  {[0, 1].map((half) => (
                    <button key={half} type="button" title="افزودن نوبت" onClick={() => { const d = new Date(date); d.setHours(h, half * 30, 0, 0); setModal({ startAt: d, therapistId: t.id }); }} className={cn("absolute inset-x-0 h-1/2 transition hover:bg-brand-50/70", half === 1 && "top-1/2 border-t border-dashed border-sand-200/60")} />
                  ))}
                </div>
              ))}
              {items.filter((a) => a.therapistId === t.id).map((a) => {
                const { top, height } = pos(a);
                return (
                  <button key={a.id} type="button" onClick={() => setActions(a)} className={cn("absolute inset-x-0.5 overflow-hidden rounded-lg border-r-4 text-right shadow-soft transition hover:shadow-card", compact ? "px-1 py-0.5 text-[10px] leading-tight" : "inset-x-1 rounded-xl px-2 py-1 text-xs", blockClass(a))} style={{ top, height, borderColor: t.color }}>
                    <p className="truncate font-bold">{a.patientName}</p>
                    {(!compact || height > 26) && <p className="num truncate">{formatTime(a.startAt)}{compact ? "" : ` - ${formatTime(a.endAt)}`}{a.room && !compact ? ` · ${a.room}` : ""}</p>}
                    {!compact && height > 50 && <p className="mt-0.5"><StatusBadge status={a.status} /></p>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader title="برنامه روزانه" subtitle={isPast ? "روز گذشته" : unfixed ? `${toPersianDigits(unfixed)} نوبت هنوز قطعی نشده` : items.length ? "همه نوبت‌ها قطعی شده ✅" : "برای این روز نوبتی ثبت نشده"} actions={<>
        <div className="flex rounded-xl bg-sand-200 p-0.5">
          <button onClick={() => changeView("fit")} title="تمام‌صفحه (بدون اسکرول)" className={cn("rounded-lg p-1.5", view === "fit" && "bg-white shadow-soft")}><Maximize2 className="h-4 w-4" /></button>
          <button onClick={() => changeView("grid")} title="جدول" className={cn("rounded-lg p-1.5", view === "grid" && "bg-white shadow-soft")}><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => changeView("list")} title="فهرست" className={cn("rounded-lg p-1.5", view === "list" && "bg-white shadow-soft")}><List className="h-4 w-4" /></button>
        </div>
        {canManage && <Link href={`/panel/finance/daily?date=${date.toISOString()}`} className="btn-secondary"><ReceiptText className="h-4 w-4" />پایان کار</Link>}
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
          <JalaliDatePicker value={date} onChange={(d) => d && setDate(startOfDay(d))} className="w-36" />
          <span className="text-sm font-bold text-brand-800">{formatJalaliLong(date, true)}</span>
          {user?.role !== "THERAPIST" && <Select value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className="w-44"><option value="">همه درمانگران</option>{therapists?.items.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select>}
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی مراجع، پرونده یا موبایل…" className="input pr-9" />
            {q && <button onClick={() => setQ("")} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-sand-200"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <div className="mr-auto flex items-center gap-2 text-xs text-slate-500">
            {needle && <Badge tone="coral">{toPersianDigits(matchCount)} نتیجه</Badge>}
            <Badge tone="amber">{toPersianDigits(unfixed)} برنامه‌ریزی‌شده</Badge><Badge tone="brand">{toPersianDigits(items.filter((a) => a.status === "CONFIRMED").length)} قطعی</Badge><Badge tone="sage">{toPersianDigits(items.filter((a) => a.status === "DONE").length)} انجام‌شده</Badge>
          </div>
          <div className="hidden w-full gap-1 text-xs text-slate-400 md:flex">{[0, 1, 2, 3, 4, 5, 6].map((i) => { const d = addDays(startOfDay(new Date()), i); const active = d.getTime() === date.getTime(); return <button key={i} onClick={() => setDate(d)} className={cn("rounded-lg px-2 py-1", active ? "bg-brand-600 text-white" : "hover:bg-sand-200")}>{WEEKDAYS_FA[d.getDay()]} {i === 0 ? "(امروز)" : ""}</button>; })}</div>
        </div>
      </Card>

      {isLoading ? <Spinner /> : !cols.length ? <EmptyState title="درمانگری تعریف نشده" /> : view === "fit" ? (
        <FitView>{(scale) => <Grid hourH={56} colW={130} labelW={26} compact />}</FitView>
      ) : view === "grid" ? (
        <Card padded={false} className="overflow-x-auto"><Grid hourH={88} colW={200} labelW={64} /></Card>
      ) : (
        <div className="space-y-4">
          {cols.map((t) => {
            const list = items.filter((a) => a.therapistId === t.id && matches(a));
            return (
              <Card key={t.id} title={<span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: t.color }} />{t.fullName}</span>} subtitle={`${toPersianDigits(list.length)} نوبت`} padded={false}>
                {list.length ? (
                  <ul className="divide-y divide-sand-100">
                    {list.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                        <span className="num w-24 text-sm font-bold text-brand-700">{formatTime(a.startAt)} - {formatTime(a.endAt)}</span>
                        <button onClick={() => setActions(a)} className="min-w-0 flex-1 text-right text-sm font-medium hover:text-brand-700">{a.patientName}<span className="mr-2 text-xs text-slate-400 num">{a.patient.fileNumber}</span></button>
                        <a href={`tel:${a.patient.phone}`} className="num text-xs text-slate-400" dir="ltr"><Phone className="inline h-3 w-3" /> {toPersianDigits(a.patient.phone)}</a>
                        <StatusBadge status={a.status} />
                        <div className="flex gap-1">
                          {canManage && a.status !== "CANCELLED" && <button onClick={() => setSettle(a.id)} className="flex items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 text-xs font-bold text-white hover:bg-brand-700"><Banknote className="h-3.5 w-3.5" />تسویه</button>}
                          <button onClick={() => openEdit(a)} className="flex items-center gap-1 rounded-lg bg-sand-200 px-2 py-1 text-xs text-slate-700 hover:bg-sand-300"><Pencil className="h-3.5 w-3.5" />ویرایش</button>
                          {a.status !== "DONE" && a.status !== "CANCELLED" && new Date(a.startAt) < new Date() && (
                            <>
                              <button onClick={() => setStatus(a, "DONE")} className="rounded-lg bg-sage-100 px-2 py-1 text-xs text-sage-700 hover:bg-sage-300">انجام شد</button>
                              <button onClick={() => setStatus(a, "NO_SHOW")} className="rounded-lg bg-coral-100 px-2 py-1 text-xs text-coral-700 hover:bg-coral-200">غیبت</button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-5 py-6 text-sm text-slate-400">{needle ? "موردی مطابق جستجو نیست" : "نوبتی ندارد"}</p>}
              </Card>
            );
          })}
        </div>
      )}

      {/* اقدامات روی یک نوبت: تسویه / ویرایش / انجام شد / غیبت */}
      {actions && (
        <Modal open onClose={() => setActions(null)} title={<span className="flex items-center gap-2">{actions.patientName}<StatusBadge status={actions.status} /></span>} size="sm">
          <p className="text-sm text-slate-500">{formatJalaliLong(actions.startAt, true)} ساعت <span className="num">{formatTime(actions.startAt)} - {formatTime(actions.endAt)}</span> · {actions.therapistName}</p>
          <p className="num mt-1 text-xs text-slate-400" dir="ltr">{toPersianDigits(actions.patient.phone)} · {actions.patient.fileNumber}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {canManage && actions.status !== "CANCELLED" && <button onClick={() => { setSettle(actions.id); setActions(null); }} className="flex flex-col items-center gap-1 rounded-2xl bg-brand-600 p-4 text-sm font-bold text-white hover:bg-brand-700"><Banknote className="h-6 w-6" />تسویه</button>}
            <button onClick={() => { openEdit(actions); setActions(null); }} className="flex flex-col items-center gap-1 rounded-2xl bg-sand-200 p-4 text-sm font-bold text-slate-700 hover:bg-sand-300"><Pencil className="h-6 w-6" />ویرایش</button>
            {actions.status !== "DONE" && actions.status !== "CANCELLED" && <button onClick={() => { setStatus(actions, "DONE"); setActions(null); }} className="rounded-2xl bg-sage-100 p-3 text-sm font-bold text-sage-700 hover:bg-sage-300">انجام شد ✅</button>}
            {actions.status !== "DONE" && actions.status !== "CANCELLED" && <button onClick={() => { setStatus(actions, "NO_SHOW"); setActions(null); }} className="rounded-2xl bg-coral-100 p-3 text-sm font-bold text-coral-700 hover:bg-coral-200">غیبت</button>}
            <a href={`tel:${actions.patient.phone}`} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-sand-200 p-3 text-sm text-slate-600 hover:bg-sand-100"><Phone className="h-4 w-4" />تماس با مراجع</a>
          </div>
        </Modal>
      )}
      {modal && <AppointmentModal open onClose={() => setModal(null)} initial={modal} onSaved={() => { setModal(null); refresh(); }} onSettle={modal.id ? () => { setSettle(modal.id); setModal(null); } : undefined} />}
      {settle && <SettleModal appointmentId={settle} onClose={() => setSettle(null)} onDone={refresh} />}
      {copyOpen && <CopyDayModal date={date} therapistId={therapistId} onClose={() => setCopyOpen(false)} onDone={() => { setCopyOpen(false); refresh(); }} />}
    </>
  );
}

/**
 * نمای «تمام‌صفحه»: کل برنامه روز طوری کوچک می‌شود که در صفحه جا شود؛
 * با دکمه‌های + و − (یا دو انگشت روی موبایل) می‌توان بزرگ‌نمایی کرد و اسکرول زد.
 */
function FitView({ children }: { children: (scale: number) => React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState(1);
  const compute = () => {
    if (!outer.current || !inner.current) return;
    const el = inner.current.firstElementChild as HTMLElement | null;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const availW = outer.current.clientWidth - 2;
    // ارتفاع در دسترس: کل ارتفاع صفحه منهای نوار بالا؛ کاربر تا کارت اسکرول می‌کند و کل برنامه در یک صفحه جا می‌شود
    const availH = Math.max(320, window.innerHeight - 110);
    const s = Math.min(availW / w, availH / h, 1.6);
    setFit(s); setScale(s);
  };
  useEffect(() => { compute(); const ro = new ResizeObserver(compute); if (outer.current) ro.observe(outer.current); window.addEventListener("resize", compute); return () => { ro.disconnect(); window.removeEventListener("resize", compute); }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const el = inner.current?.firstElementChild as HTMLElement | null;
  const w = el?.offsetWidth ?? 0, h = el?.offsetHeight ?? 0;
  return (
    <Card padded={false} className="relative">
      <div className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded-xl bg-white/90 p-1 shadow-soft backdrop-blur">
        <button onClick={() => setScale((s) => Math.max(0.3, s - 0.15))} className="rounded-lg p-1.5 hover:bg-sand-200" title="کوچک‌تر"><ZoomOut className="h-4 w-4" /></button>
        <button onClick={() => setScale(fit)} className="num rounded-lg px-2 py-1 text-xs hover:bg-sand-200" title="اندازه‌ی جا شونده در صفحه">{toPersianDigits(Math.round(scale * 100))}٪</button>
        <button onClick={() => setScale((s) => Math.min(2, s + 0.15))} className="rounded-lg p-1.5 hover:bg-sand-200" title="بزرگ‌تر"><ZoomIn className="h-4 w-4" /></button>
      </div>
      <div ref={outer} className="overflow-auto overscroll-contain" style={{ maxHeight: "calc(100vh - 110px)", touchAction: "pan-x pan-y pinch-zoom" }}>
        <div style={{ width: w * scale || undefined, height: h * scale || undefined }}>
          <div ref={inner} style={{ transform: `scale(${scale})`, transformOrigin: "top right", width: w || undefined }}>{children(scale)}</div>
        </div>
      </div>
    </Card>
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
      <p className="mb-3 text-sm text-slate-500">برای مراجعینی که برنامه هفتگی ثابت دارند، نوبت‌های یک روز (مثلاً هفته قبل) را به این روز کپی کنید. نوبت‌ها با وضعیت «برنامه‌ریزی‌شده» ساخته می‌شوند تا پس از بازبینی قطعی کنید.</p>
      <Field label="کپی از تاریخ"><JalaliDatePicker value={from} onChange={setFrom} /></Field>
    </Modal>
  );
}

export default function SchedulePage() {
  return <Suspense><Inner /></Suspense>;
}

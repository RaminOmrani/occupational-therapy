"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Activity, TrendingUp, Target, Dumbbell, Plus, CalendarDays, Check, ExternalLink } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ASSESSMENT_TEMPLATES, ASSESSMENT_TYPE_LABELS, GOAL_STATUSES, GOAL_STATUS_LABELS, formatJalali, formatJalaliLong, formatTime, toPersianDigits, type AssessmentType } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, EmptyState, Field, Input, Modal, ProgressBar, Select, Spinner, Tabs, Textarea, Badge } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { cn } from "@/lib/utils";

type Tab = "assessments" | "intake" | "progress" | "goals" | "home" | "appointments";

/** پرونده بالینی بیمار: مشترک بین نمای کارکنان و نمای خود بیمار */
export function RecordsPanel({ patientId, initialTab = "assessments" }: { patientId: string; initialTab?: Tab }) {
  const { user } = useAuth();
  const isStaff = user?.role !== "PATIENT";
  const canWrite = user?.role === "THERAPIST" || user?.role === "ADMIN";
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab);
  const { data, isLoading } = useQuery({ queryKey: ["timeline", patientId], queryFn: () => api.get<any>(`/patients/${patientId}/timeline`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["timeline", patientId] });
  if (isLoading || !data) return <Spinner />;

  const trend = data.assessments
    .slice()
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc: any[], a: any) => {
      const label = formatJalali(a.date);
      let row = acc.find((r) => r.label === label);
      if (!row) { row = { label }; acc.push(row); }
      row[a.type] = a.maxScore ? Math.round((a.score / a.maxScore) * 100) : 0;
      return acc;
    }, []);

  const latestOf = (type: AssessmentType) => data.assessments.find((a: any) => a.type === type);

  return (
    <div className="space-y-5">
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "assessments", label: "ارزیابی‌ها", count: data.assessments.length },
        { key: "progress", label: "گزارش پیشرفت", count: data.progress.length },
        { key: "intake", label: "شرح حال", count: data.intakes.length },
        { key: "goals", label: "اهداف درمانی", count: data.goals.length },
        { key: "home", label: "تمرین خانگی", count: data.homePrograms.length },
        { key: "appointments", label: "جلسات", count: data.appointments.length },
      ]} />

      {tab === "assessments" && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(ASSESSMENT_TEMPLATES) as AssessmentType[]).map((type) => {
              const t = ASSESSMENT_TEMPLATES[type];
              const a = latestOf(type);
              const pct = a && a.maxScore ? Math.round((a.score / a.maxScore) * 100) : null;
              const tone = type === "PHYSICAL" ? "brand" : type === "PERCEPTUAL_MOTOR" ? "amber" : "violet";
              return (
                <Card key={type} className="relative">
                  <div className="flex items-start justify-between">
                    <div><h4 className="font-bold">{t.title}</h4><p className="mt-0.5 text-xs text-slate-400">{a ? `آخرین: ${formatJalali(a.date)}` : "هنوز ثبت نشده"}</p></div>
                    <span className={cn("num text-2xl font-black", pct === null ? "text-slate-300" : `text-${tone}-600`)}>{pct === null ? "—" : `${toPersianDigits(pct)}٪`}</span>
                  </div>
                  {pct !== null && <ProgressBar value={pct} tone={tone} className="mt-3" />}
                  <div className="mt-3 flex gap-2">
                    {a && <Link href={`/panel/forms/assessments/${a.id}`} className="text-xs text-brand-600 hover:underline">مشاهده جزئیات</Link>}
                    {canWrite && <Link href={`/panel/forms/assessments/new?patientId=${patientId}&type=${type}`} className="text-xs text-coral-600 hover:underline">{a ? "ارزیابی مجدد" : "ثبت ارزیابی"}</Link>}
                  </div>
                </Card>
              );
            })}
          </div>
          {trend.length > 1 && (
            <Card title="روند پیشرفت ارزیابی‌ها" subtitle="درصد امتیاز هر پروفایل در طول زمان">
              <div className="h-64" dir="ltr">
                <ResponsiveContainer>
                  <LineChart data={trend}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12, direction: "rtl" }} formatter={(v: any, n: any) => [`${toPersianDigits(v)}٪`, ASSESSMENT_TYPE_LABELS[n as AssessmentType]]} />
                    <Legend formatter={(v) => ASSESSMENT_TYPE_LABELS[v as AssessmentType]} wrapperStyle={{ fontFamily: "Vazirmatn", fontSize: 12 }} />
                    <Line type="monotone" dataKey="PHYSICAL" stroke="#178a6e" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                    <Line type="monotone" dataKey="PERCEPTUAL_MOTOR" stroke="#f4a261" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                    <Line type="monotone" dataKey="COGNITIVE" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          {data.assessments.length > 0 && (
            <Card title="تاریخچه ارزیابی‌ها" padded={false} className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>تاریخ</th><th>نوع</th><th>درمانگر</th><th>امتیاز</th><th>خلاصه</th><th></th></tr></thead>
                <tbody>{data.assessments.map((a: any) => (
                  <tr key={a.id}><td className="num">{formatJalali(a.date)}</td><td>{ASSESSMENT_TYPE_LABELS[a.type as AssessmentType]}</td><td>{a.therapist.user.firstName} {a.therapist.user.lastName}</td><td className="num">{toPersianDigits(a.score)} / {toPersianDigits(a.maxScore)}</td><td className="max-w-xs truncate text-xs text-slate-500">{a.summary ?? "-"}</td><td><Link href={`/panel/forms/assessments/${a.id}`} className="text-brand-600"><ExternalLink className="h-4 w-4" /></Link></td></tr>
                ))}</tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {tab === "intake" && (
        <div className="space-y-4">
          {canWrite && <Link href={`/panel/forms/intake/new?patientId=${patientId}`} className="btn-primary"><Plus className="h-4 w-4" />شرح حال جدید</Link>}
          {data.intakes.length ? data.intakes.map((f: any) => (
            <Card key={f.id} title={<span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-brand-500" />شرح حال {formatJalaliLong(f.date)}</span>} subtitle={`${f.therapist.user.firstName} ${f.therapist.user.lastName}`} actions={<Link href={`/panel/forms/intake/${f.id}`} className="text-xs text-brand-600 hover:underline">{isStaff ? "مشاهده / ویرایش" : "مشاهده"}</Link>}>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-400">شکایت اصلی</dt><dd className="leading-6">{f.chiefComplaint}</dd></div>
                {f.diagnosis && <div><dt className="text-xs text-slate-400">تشخیص</dt><dd>{f.diagnosis}</dd></div>}
                {f.plan && <div className="sm:col-span-2"><dt className="text-xs text-slate-400">برنامه درمان</dt><dd className="leading-6">{f.plan}</dd></div>}
              </dl>
            </Card>
          )) : <EmptyState title="شرح حالی ثبت نشده" icon={<ClipboardList className="h-6 w-6" />} />}
        </div>
      )}

      {tab === "progress" && (
        <div className="space-y-4">
          {canWrite && <Link href={`/panel/forms/progress/new?patientId=${patientId}`} className="btn-primary"><Plus className="h-4 w-4" />گزارش جلسه جدید</Link>}
          {data.progress.length ? (
            <div className="relative space-y-4 border-r-2 border-sand-300 pr-6">
              {data.progress.map((n: any) => (
                <div key={n.id} className="relative">
                  <span className="absolute -right-[31px] top-4 grid h-4 w-4 place-items-center rounded-full bg-brand-500 ring-4 ring-sand-100" />
                  <Card>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm"><Badge tone="brand">جلسه {toPersianDigits(n.sessionNumber)}</Badge><span className="text-slate-500">{formatJalaliLong(n.date)}</span><span className="text-xs text-slate-400">· {n.therapist.user.firstName} {n.therapist.user.lastName}</span></div>
                      <div className="flex items-center gap-2 text-xs">
                        {n.progressScore && <span className="rounded-full bg-sage-100 px-2 py-0.5 text-sage-700">پیشرفت {toPersianDigits(n.progressScore)}/۱۰</span>}
                        {n.cooperation && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-600">همکاری {toPersianDigits(n.cooperation)}/۵</span>}
                        <Link href={`/panel/forms/progress/${n.id}`} className="text-brand-600 hover:underline">جزئیات</Link>
                      </div>
                    </div>
                    {n.activities && <p className="text-sm leading-7"><span className="text-slate-400">فعالیت‌ها: </span>{n.activities}</p>}
                    {n.assessment && <p className="text-sm leading-7"><span className="text-slate-400">ارزیابی: </span>{n.assessment}</p>}
                    {n.homework && <p className="mt-1 rounded-xl bg-coral-50 px-3 py-2 text-sm text-coral-800"><span className="font-medium">تکلیف خانگی: </span>{n.homework}</p>}
                  </Card>
                </div>
              ))}
            </div>
          ) : <EmptyState title="گزارشی ثبت نشده" icon={<TrendingUp className="h-6 w-6" />} />}
        </div>
      )}

      {tab === "goals" && <GoalsTab patientId={patientId} goals={data.goals} canWrite={canWrite} onChange={refresh} />}
      {tab === "home" && <HomeTab patientId={patientId} programs={data.homePrograms} canWrite={canWrite} isPatient={!isStaff} onChange={refresh} />}

      {tab === "appointments" && (
        <Card padded={false} className="overflow-x-auto">
          {data.appointments.length ? (
            <table className="table">
              <thead><tr><th>تاریخ</th><th>ساعت</th><th>درمانگر</th><th>وضعیت</th><th>یادداشت</th></tr></thead>
              <tbody>{data.appointments.map((a: any) => (
                <tr key={a.id}><td className="num">{formatJalaliLong(a.startAt, true)}</td><td className="num">{formatTime(a.startAt)} - {formatTime(a.endAt)}</td><td>{a.therapist.user.firstName} {a.therapist.user.lastName}</td><td><StatusBadge status={a.status} /></td><td className="text-xs text-slate-500">{a.notes ?? ""}</td></tr>
              ))}</tbody>
            </table>
          ) : <EmptyState title="جلسه‌ای ثبت نشده" icon={<CalendarDays className="h-6 w-6" />} />}
        </Card>
      )}
    </div>
  );
}

function GoalsTab({ patientId, goals, canWrite, onChange }: { patientId: string; goals: any[]; canWrite: boolean; onChange: () => void }) {
  const [edit, setEdit] = useState<any | null>(null);
  const [v, setV] = useState({ title: "", description: "", category: "PHYSICAL", targetDate: null as Date | null, progress: 0, status: "ACTIVE" });
  const [loading, setLoading] = useState(false);
  const open = (g?: any) => { setV({ title: g?.title ?? "", description: g?.description ?? "", category: g?.category ?? "PHYSICAL", targetDate: g?.targetDate ? new Date(g.targetDate) : null, progress: g?.progress ?? 0, status: g?.status ?? "ACTIVE" }); setEdit(g ?? {}); };
  const save = async () => {
    setLoading(true);
    try {
      const payload = { ...v, patientId, targetDate: v.targetDate?.toISOString() ?? null };
      if (edit?.id) await api.patch(`/forms/goals/${edit.id}`, payload); else await api.post("/forms/goals", payload);
      toast.success("ذخیره شد"); setEdit(null); onChange();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const cats: Record<string, string> = { PHYSICAL: "جسمی", PERCEPTUAL_MOTOR: "ادراکی-حرکتی", COGNITIVE: "شناختی", ADL: "فعالیت روزمره", OTHER: "سایر" };
  return (
    <div className="space-y-4">
      {canWrite && <Button onClick={() => open()} icon={<Plus className="h-4 w-4" />}>هدف جدید</Button>}
      {goals.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => (
            <Card key={g.id}>
              <div className="flex items-start justify-between gap-2">
                <div><h4 className="flex items-center gap-2 font-bold"><Target className="h-4 w-4 text-brand-500" />{g.title}</h4><p className="mt-1 text-xs text-slate-400">{cats[g.category] ?? ""}{g.targetDate ? ` · هدف تا ${formatJalali(g.targetDate)}` : ""}</p></div>
                <StatusBadge status={g.status} />
              </div>
              {g.description && <p className="mt-2 text-sm leading-6 text-slate-600">{g.description}</p>}
              <div className="mt-3 flex items-center gap-3"><ProgressBar value={g.progress} tone={g.status === "ACHIEVED" ? "sage" : "brand"} className="flex-1" /><span className="num text-sm font-bold">{toPersianDigits(g.progress)}٪</span></div>
              {canWrite && <button onClick={() => open(g)} className="mt-2 text-xs text-brand-600 hover:underline">ویرایش / به‌روزرسانی پیشرفت</button>}
            </Card>
          ))}
        </div>
      ) : <EmptyState title="هدفی تعریف نشده" icon={<Target className="h-6 w-6" />} />}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? "ویرایش هدف" : "هدف درمانی جدید"} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>انصراف</Button><Button loading={loading} onClick={save}>ذخیره</Button></>}>
          <div className="space-y-3">
            <Field label="عنوان" required><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus /></Field>
            <Field label="توضیح"><Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className="min-h-[60px]" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="حوزه"><Select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{Object.entries(cats).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="تاریخ هدف"><JalaliDatePicker value={v.targetDate} onChange={(d) => setV({ ...v, targetDate: d })} /></Field>
              <Field label={`پیشرفت: ${toPersianDigits(v.progress)}٪`}><input type="range" min={0} max={100} step={5} value={v.progress} onChange={(e) => setV({ ...v, progress: Number(e.target.value) })} className="w-full accent-brand-600" /></Field>
              <Field label="وضعیت"><Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>{GOAL_STATUSES.map((s) => <option key={s} value={s}>{GOAL_STATUS_LABELS[s]}</option>)}</Select></Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function HomeTab({ patientId, programs, canWrite, isPatient, onChange }: { patientId: string; programs: any[]; canWrite: boolean; isPatient: boolean; onChange: () => void }) {
  const [edit, setEdit] = useState<any | null>(null);
  const [v, setV] = useState({ title: "", description: "", frequency: "روزانه", videoUrl: "" });
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const save = async () => {
    setLoading(true);
    try {
      if (edit?.id) await api.patch(`/forms/home-programs/${edit.id}`, v); else await api.post("/forms/home-programs", { ...v, patientId });
      toast.success("ذخیره شد"); setEdit(null); onChange();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const toggle = async (id: string) => { try { await api.post(`/forms/home-programs/${id}/complete`, { date: today }); onChange(); } catch (e: any) { toast.error(e.message); } };
  const deactivate = async (id: string) => { try { await api.patch(`/forms/home-programs/${id}`, { isActive: false }); onChange(); } catch (e: any) { toast.error(e.message); } };
  return (
    <div className="space-y-4">
      {canWrite && <Button onClick={() => { setV({ title: "", description: "", frequency: "روزانه", videoUrl: "" }); setEdit({}); }} icon={<Plus className="h-4 w-4" />}>تمرین جدید</Button>}
      {programs.length ? programs.map((h) => {
        const done = h.completions.includes(today);
        const week = Array.from({ length: 7 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().slice(0, 10); });
        return (
          <Card key={h.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h4 className="flex items-center gap-2 font-bold"><Dumbbell className="h-4 w-4 text-coral-500" />{h.title}</h4>
                <p className="mt-1 text-sm leading-7 text-slate-600">{h.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  {h.frequency && <span>تکرار: {h.frequency}</span>}
                  {h.videoUrl && <a href={h.videoUrl} target="_blank" className="text-brand-600 hover:underline">ویدئوی آموزشی</a>}
                  <span className="flex items-center gap-1">هفته اخیر: {week.map((d) => <span key={d} className={cn("h-3 w-3 rounded-sm", h.completions.includes(d) ? "bg-sage-500" : "bg-sand-300")} title={formatJalali(d)} />)}</span>
                </div>
              </div>
              {isPatient ? (
                <button onClick={() => toggle(h.id)} className={cn("flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition", done ? "bg-sage-500 text-white" : "bg-sand-200 text-slate-600 hover:bg-sage-100")}><Check className="h-4 w-4" />{done ? "امروز انجام شد" : "انجام دادم"}</button>
              ) : canWrite ? (
                <div className="flex flex-col gap-1 text-xs"><button onClick={() => { setV({ title: h.title, description: h.description, frequency: h.frequency ?? "", videoUrl: h.videoUrl ?? "" }); setEdit(h); }} className="text-brand-600 hover:underline">ویرایش</button><button onClick={() => deactivate(h.id)} className="text-slate-400 hover:underline">پایان</button></div>
              ) : null}
            </div>
          </Card>
        );
      }) : <EmptyState title="تمرین خانگی فعالی نیست" icon={<Dumbbell className="h-6 w-6" />} />}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? "ویرایش تمرین" : "تمرین خانگی جدید"} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>انصراف</Button><Button loading={loading} onClick={save}>ذخیره</Button></>}>
          <div className="space-y-3">
            <Field label="عنوان" required><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus /></Field>
            <Field label="شرح تمرین" required><Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="تکرار"><Input value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value })} placeholder="روزانه، ۳ بار در هفته..." /></Field>
              <Field label="لینک ویدئو"><Input value={v.videoUrl} onChange={(e) => setV({ ...v, videoUrl: e.target.value })} dir="ltr" /></Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

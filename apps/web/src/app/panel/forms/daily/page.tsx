"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NotebookPen, Plus, Pencil, Trash2, Smile } from "lucide-react";
import { formatJalaliLong, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/hooks";
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useConfirm } from "@/components/ui";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { cn } from "@/lib/utils";

const MOODS = ["😞", "😐", "🙂", "😊", "🤩"];

export default function DailyPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const { data: therapists } = useTherapists();
  const [therapistUserId, setTherapistUserId] = useState("");
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [edit, setEdit] = useState<any | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["daily", therapistUserId, from, to], queryFn: () => api.get<{ items: any[] }>("/forms/daily", { therapistUserId, from: from?.toISOString(), to: to?.toISOString() }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["daily"] });
  const remove = async (id: string) => { if (!(await confirm("این گزارش حذف شود؟"))) return; await api.delete(`/forms/daily/${id}`); refresh(); };
  return (
    <>
      {dialog}
      <PageHeader title="عملکرد روزانه" subtitle="گزارش روزانه فعالیت‌های درمانگر" icon={<NotebookPen className="h-5 w-5" />} actions={<Button onClick={() => setEdit({})} icon={<Plus className="h-4 w-4" />}>ثبت عملکرد امروز</Button>} />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3">
          {user?.role === "ADMIN" && <Select value={therapistUserId} onChange={(e) => setTherapistUserId(e.target.value)}><option value="">همه درمانگران</option>{therapists?.items.map((t) => <option key={t.userId} value={t.userId}>{t.fullName}</option>)}</Select>}
          <JalaliDatePicker value={from} onChange={setFrom} placeholder="از تاریخ" />
          <JalaliDatePicker value={to} onChange={setTo} placeholder="تا تاریخ" />
        </div>
      </Card>
      {isLoading ? <Spinner /> : data?.items.length ? (
        <div className="space-y-4">
          {data.items.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{formatJalaliLong(d.date, true)}</h3>
                  <p className="text-xs text-slate-400">{d.therapistName}{d.patientName ? ` · بیمار: ${d.patientName}` : ""} · {toPersianDigits(d.sessionsDone)} جلسه</p>
                </div>
                <div className="flex items-center gap-2">
                  {d.mood && <span className="text-xl" title="حال و انرژی">{MOODS[d.mood - 1]}</span>}
                  {(user?.role === "ADMIN" || d.therapistUserId === user?.id) && <><button onClick={() => setEdit(d)} className="text-slate-400 hover:text-brand-600"><Pencil className="h-4 w-4" /></button><button onClick={() => remove(d.id)} className="text-slate-400 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button></>}
                </div>
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                <div><p className="text-xs text-slate-400">فعالیت‌ها</p><p className="leading-6">{d.activities}</p></div>
                {d.achievements && <div><p className="text-xs text-sage-700">دستاوردها</p><p className="leading-6">{d.achievements}</p></div>}
                {d.challenges && <div><p className="text-xs text-coral-600">چالش‌ها</p><p className="leading-6">{d.challenges}</p></div>}
              </div>
              {d.notes && <p className="mt-2 text-xs text-slate-500">{d.notes}</p>}
            </Card>
          ))}
        </div>
      ) : <EmptyState title="گزارشی ثبت نشده" icon={<NotebookPen className="h-6 w-6" />} action={<Button onClick={() => setEdit({})}>ثبت عملکرد امروز</Button>} />}
      {edit && <DailyModal initial={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); refresh(); }} />}
    </>
  );
}

function DailyModal({ initial, onClose, onDone }: { initial: any; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const { data: therapists } = useTherapists();
  const [v, setV] = useState({ date: initial.date ? new Date(initial.date) : new Date(), patientId: initial.patientId ?? "", patientLabel: initial.patientName ?? "", sessionsDone: initial.sessionsDone ?? "", activities: initial.activities ?? "", achievements: initial.achievements ?? "", challenges: initial.challenges ?? "", mood: initial.mood ?? 0, notes: initial.notes ?? "", therapistUserId: initial.therapistUserId ?? "" });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!v.activities.trim()) return toast.error("شرح فعالیت‌ها الزامی است");
    setLoading(true);
    try {
      const payload = { ...v, date: v.date.toISOString(), sessionsDone: Number(v.sessionsDone || 0), mood: v.mood || null, patientId: v.patientId || null, therapistUserId: v.therapistUserId || undefined };
      if (initial.id) await api.patch(`/forms/daily/${initial.id}`, payload); else await api.post("/forms/daily", payload);
      toast.success("ذخیره شد"); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title={initial.id ? "ویرایش عملکرد روزانه" : "ثبت عملکرد روزانه"} size="lg" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={save}>ذخیره</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="تاریخ"><JalaliDatePicker value={v.date} onChange={(d) => d && setV({ ...v, date: d })} /></Field>
        {user?.role === "ADMIN" && !initial.id && <Field label="درمانگر" required><Select value={v.therapistUserId} onChange={(e) => setV({ ...v, therapistUserId: e.target.value })}><option value="">انتخاب کنید</option>{therapists?.items.map((t) => <option key={t.userId} value={t.userId}>{t.fullName}</option>)}</Select></Field>}
        <Field label="بیمار (اختیاری)" hint="اگر گزارش مربوط به یک بیمار خاص است"><PatientPicker value={v.patientId} initialLabel={v.patientLabel} onChange={(id, p) => setV({ ...v, patientId: id ?? "", patientLabel: p?.fullName ?? "" })} /></Field>
        <Field label="تعداد جلسات انجام‌شده"><Input type="number" min={0} value={v.sessionsDone} onChange={(e) => setV({ ...v, sessionsDone: e.target.value })} className="num" dir="ltr" /></Field>
        <Field label="فعالیت‌های امروز" required className="sm:col-span-2"><Textarea value={v.activities} onChange={(e) => setV({ ...v, activities: e.target.value })} rows={3} autoFocus /></Field>
        <Field label="دستاوردها و نکات مثبت"><Textarea value={v.achievements} onChange={(e) => setV({ ...v, achievements: e.target.value })} rows={2} /></Field>
        <Field label="چالش‌ها و مشکلات"><Textarea value={v.challenges} onChange={(e) => setV({ ...v, challenges: e.target.value })} rows={2} /></Field>
        <Field label="حال و انرژی امروز"><div className="flex gap-2">{MOODS.map((m, i) => <button key={i} type="button" onClick={() => setV({ ...v, mood: v.mood === i + 1 ? 0 : i + 1 })} className={cn("grid h-11 flex-1 place-items-center rounded-xl border text-2xl transition", v.mood === i + 1 ? "border-brand-500 bg-brand-50" : "border-sand-300")}>{m}</button>)}</div></Field>
        <Field label="یادداشت"><Input value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

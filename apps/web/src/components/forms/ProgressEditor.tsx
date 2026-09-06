"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Trash2, Printer } from "lucide-react";
import { toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, Field, Input, Textarea, useConfirm } from "@/components/ui";
import { FormHeaderFields, useFormHead, usePatientLabel } from "./FormHeader";
import { cn } from "@/lib/utils";

export function ProgressEditor({ id, initialPatientId, appointmentId }: { id?: string; initialPatientId?: string; appointmentId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [head, setHead] = useFormHead({ patientId: initialPatientId });
  const label = usePatientLabel(!head.patientLabel ? head.patientId : null);
  const [v, setV] = useState({ sessionNumber: "", subjective: "", objective: "", assessment: "", plan: "", activities: "", homework: "", progressScore: 0, cooperation: 0 });
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(!id);
  const readOnly = user?.role === "PATIENT" || user?.role === "SECRETARY";

  useEffect(() => { if (label && !head.patientLabel) setHead((h) => ({ ...h, patientLabel: label })); }, [label, head.patientLabel, setHead]);
  useEffect(() => {
    if (!id) return;
    api.get<{ form: any }>(`/forms/progress/${id}`).then(({ form }) => {
      setHead({ patientId: form.patientId, patientLabel: form.patientName, therapistId: form.therapistId, date: new Date(form.date), visibleToPatient: form.visibleToPatient });
      setV({ sessionNumber: form.sessionNumber ?? "", subjective: form.subjective ?? "", objective: form.objective ?? "", assessment: form.assessment ?? "", plan: form.plan ?? "", activities: form.activities ?? "", homework: form.homework ?? "", progressScore: form.progressScore ?? 0, cooperation: form.cooperation ?? 0 });
      setLoaded(true);
    }).catch((e) => toast.error(e.message));
  }, [id, setHead]);

  const save = async () => {
    if (!head.patientId) return toast.error("بیمار را انتخاب کنید");
    setLoading(true);
    try {
      const payload = { ...v, sessionNumber: v.sessionNumber ? Number(v.sessionNumber) : null, progressScore: v.progressScore || null, cooperation: v.cooperation || null, patientId: head.patientId, therapistId: head.therapistId || undefined, date: head.date?.toISOString(), visibleToPatient: head.visibleToPatient, appointmentId };
      const r = id ? await api.patch<{ form: any }>(`/forms/progress/${id}`, payload) : await api.post<{ form: any }>("/forms/progress", payload);
      toast.success("گزارش ذخیره شد");
      if (!id) router.replace(`/panel/forms/progress/${r.form.id}`);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const remove = async () => { if (!(await confirm("این گزارش حذف شود؟"))) return; await api.delete(`/forms/progress/${id}`); toast.success("حذف شد"); router.push("/panel/forms/progress"); };
  if (!loaded) return null;

  const Scale = ({ label, max, value, onChange, tone }: { label: string; max: number; value: number; onChange: (n: number) => void; tone: string }) => (
    <Field label={label}>
      <div className="flex gap-1">{Array.from({ length: max }).map((_, i) => <button key={i} type="button" disabled={readOnly} onClick={() => onChange(value === i + 1 ? 0 : i + 1)} className={cn("num h-9 flex-1 rounded-lg border text-xs font-bold transition", value >= i + 1 ? `${tone} text-white border-transparent` : "border-sand-300 bg-white")}>{toPersianDigits(i + 1)}</button>)}</div>
    </Field>
  );

  return (
    <div className="space-y-5">
      {dialog}
      <Card title="مشخصات گزارش">
        <FormHeaderFields value={head} onChange={setHead} locked={!!id} />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="شماره جلسه" hint="خالی = خودکار"><Input value={v.sessionNumber} onChange={(e) => setV({ ...v, sessionNumber: e.target.value })} className="num" dir="ltr" disabled={readOnly} /></Field>
          <Scale label="میزان پیشرفت (۱ تا ۱۰)" max={10} value={v.progressScore} onChange={(n) => setV({ ...v, progressScore: n })} tone="bg-sage-500" />
          <Scale label="همکاری مراجع (۱ تا ۵)" max={5} value={v.cooperation} onChange={(n) => setV({ ...v, cooperation: n })} tone="bg-amber-400" />
        </div>
      </Card>
      <Card title="گزارش جلسه (SOAP)">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="فعالیت‌های انجام‌شده" className="md:col-span-2"><Textarea value={v.activities} onChange={(e) => setV({ ...v, activities: e.target.value })} rows={3} disabled={readOnly} placeholder="تمرین‌ها و مداخلات این جلسه" /></Field>
          <Field label="S — گزارش ذهنی (Subjective)" hint="آنچه مراجع/خانواده گفتند"><Textarea value={v.subjective} onChange={(e) => setV({ ...v, subjective: e.target.value })} rows={3} disabled={readOnly} /></Field>
          <Field label="O — مشاهدات عینی (Objective)" hint="اندازه‌گیری‌ها و مشاهدات درمانگر"><Textarea value={v.objective} onChange={(e) => setV({ ...v, objective: e.target.value })} rows={3} disabled={readOnly} /></Field>
          <Field label="A — ارزیابی (Assessment)" hint="تحلیل پیشرفت نسبت به اهداف"><Textarea value={v.assessment} onChange={(e) => setV({ ...v, assessment: e.target.value })} rows={3} disabled={readOnly} /></Field>
          <Field label="P — برنامه (Plan)" hint="برنامه جلسه بعد"><Textarea value={v.plan} onChange={(e) => setV({ ...v, plan: e.target.value })} rows={3} disabled={readOnly} /></Field>
          <Field label="تکلیف خانگی" hint="در پنل بیمار برجسته نمایش داده می‌شود" className="md:col-span-2"><Textarea value={v.homework} onChange={(e) => setV({ ...v, homework: e.target.value })} rows={2} disabled={readOnly} /></Field>
        </div>
      </Card>
      <div className="no-print flex flex-wrap justify-end gap-2">
        {id && <Button variant="ghost" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ</Button>}
        {id && !readOnly && <Button variant="ghost" className="text-coral-600" onClick={remove} icon={<Trash2 className="h-4 w-4" />}>حذف</Button>}
        {!readOnly && <Button loading={loading} onClick={save} icon={<Save className="h-4 w-4" />}>ذخیره گزارش</Button>}
      </div>
    </div>
  );
}

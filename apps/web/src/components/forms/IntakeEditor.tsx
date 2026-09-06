"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Trash2, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, Field, Input, Textarea, useConfirm } from "@/components/ui";
import { FormHeaderFields, useFormHead, usePatientLabel } from "./FormHeader";

const FIELDS: { key: string; label: string; hint?: string; rows?: number }[] = [
  { key: "chiefComplaint", label: "شکایت اصلی / علت مراجعه", hint: "به زبان خود مراجع یا خانواده", rows: 3 },
  { key: "historyPresent", label: "تاریخچه مشکل فعلی", hint: "شروع، سیر، عوامل تشدید/تخفیف", rows: 4 },
  { key: "medicalHistory", label: "سابقه پزشکی", hint: "بیماری‌ها، جراحی‌ها، بستری" },
  { key: "medications", label: "داروهای مصرفی" },
  { key: "developmental", label: "تاریخچه رشدی (کودکان)", hint: "بارداری، زایمان، نقاط عطف رشدی" },
  { key: "familyHistory", label: "سابقه خانوادگی" },
  { key: "socialHistory", label: "وضعیت اجتماعی و تحصیلی/شغلی" },
  { key: "previousTherapy", label: "درمان‌های قبلی" },
  { key: "precautions", label: "احتیاط‌ها و موارد منع", hint: "تشنج، آلرژی، محدودیت حرکتی..." },
  { key: "expectations", label: "انتظارات مراجع/خانواده از درمان" },
  { key: "diagnosis", label: "تشخیص کاردرمانی" },
  { key: "plan", label: "برنامه درمانی پیشنهادی", hint: "تعداد جلسات، رویکرد، اهداف کلی", rows: 4 },
];

export function IntakeEditor({ id, initialPatientId }: { id?: string; initialPatientId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [head, setHead] = useFormHead({ patientId: initialPatientId });
  const label = usePatientLabel(!head.patientLabel ? head.patientId : null);
  const [v, setV] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(!id);
  const readOnly = user?.role === "PATIENT" || user?.role === "SECRETARY";

  useEffect(() => { if (label && !head.patientLabel) setHead((h) => ({ ...h, patientLabel: label })); }, [label, head.patientLabel, setHead]);
  useEffect(() => {
    if (!id) return;
    api.get<{ form: any }>(`/forms/intake/${id}`).then(({ form }) => {
      setHead({ patientId: form.patientId, patientLabel: `${form.patientName}`, therapistId: form.therapistId, date: new Date(form.date), visibleToPatient: form.visibleToPatient });
      const o: Record<string, string> = {};
      for (const f of FIELDS) o[f.key] = form[f.key] ?? "";
      setV(o);
      setLoaded(true);
    }).catch((e) => toast.error(e.message));
  }, [id, setHead]);

  const save = async () => {
    if (!head.patientId) return toast.error("بیمار را انتخاب کنید");
    if (!v.chiefComplaint?.trim()) return toast.error("شکایت اصلی الزامی است");
    setLoading(true);
    try {
      const payload = { ...v, patientId: head.patientId, therapistId: head.therapistId || undefined, date: head.date?.toISOString(), visibleToPatient: head.visibleToPatient };
      const r = id ? await api.patch<{ form: any }>(`/forms/intake/${id}`, payload) : await api.post<{ form: any }>("/forms/intake", payload);
      toast.success("شرح حال ذخیره شد");
      if (!id) router.replace(`/panel/forms/intake/${r.form.id}`);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const remove = async () => { if (!(await confirm("این فرم حذف شود؟"))) return; await api.delete(`/forms/intake/${id}`); toast.success("حذف شد"); router.push("/panel/forms/intake"); };
  if (!loaded) return null;
  return (
    <div className="space-y-5">
      {dialog}
      <Card title="مشخصات فرم"><FormHeaderFields value={head} onChange={setHead} locked={!!id} /></Card>
      <Card title="شرح حال">
        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint} required={f.key === "chiefComplaint"} className={f.rows && f.rows > 3 ? "md:col-span-2" : ""}>
              {f.rows ? <Textarea value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} rows={f.rows} disabled={readOnly} /> : <Input value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} disabled={readOnly} />}
            </Field>
          ))}
        </div>
      </Card>
      <div className="no-print flex flex-wrap justify-end gap-2">
        {id && <Button variant="ghost" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ</Button>}
        {id && !readOnly && <Button variant="ghost" className="text-coral-600" onClick={remove} icon={<Trash2 className="h-4 w-4" />}>حذف</Button>}
        {!readOnly && <Button loading={loading} onClick={save} icon={<Save className="h-4 w-4" />}>ذخیره</Button>}
      </div>
    </div>
  );
}

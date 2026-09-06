"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Trash2, Printer, Info } from "lucide-react";
import { ASSESSMENT_TEMPLATES, ASSESSMENT_TYPES, SCORE_LABELS, assessmentScore, toPersianDigits, type AssessmentType, type AssessmentItemValue } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, Field, ProgressBar, Textarea, useConfirm, Tabs } from "@/components/ui";
import { FormHeaderFields, useFormHead, usePatientLabel } from "./FormHeader";
import { cn } from "@/lib/utils";

const TONES: Record<AssessmentType, "brand" | "amber" | "violet"> = { PHYSICAL: "brand", PERCEPTUAL_MOTOR: "amber", COGNITIVE: "violet" };

export function AssessmentEditor({ id, initialPatientId, initialType }: { id?: string; initialPatientId?: string; initialType?: AssessmentType }) {
  const router = useRouter();
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [head, setHead] = useFormHead({ patientId: initialPatientId });
  const label = usePatientLabel(!head.patientLabel ? head.patientId : null);
  const [type, setType] = useState<AssessmentType>(initialType && ASSESSMENT_TYPES.includes(initialType) ? initialType : "PHYSICAL");
  const [items, setItems] = useState<Record<string, AssessmentItemValue>>({});
  const [summary, setSummary] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(!id);
  const readOnly = user?.role === "PATIENT" || user?.role === "SECRETARY";
  const tpl = ASSESSMENT_TEMPLATES[type];

  useEffect(() => { if (label && !head.patientLabel) setHead((h) => ({ ...h, patientLabel: label })); }, [label, head.patientLabel, setHead]);
  useEffect(() => {
    if (!id) return;
    api.get<{ form: any }>(`/forms/assessments/${id}`).then(({ form }) => {
      setHead({ patientId: form.patientId, patientLabel: form.patientName, therapistId: form.therapistId, date: new Date(form.date), visibleToPatient: form.visibleToPatient });
      setType(form.type);
      setItems(Object.fromEntries((form.items as AssessmentItemValue[]).map((i) => [i.key, i])));
      setSummary(form.summary ?? "");
      setRecommendations(form.recommendations ?? "");
      setLoaded(true);
    }).catch((e) => toast.error(e.message));
  }, [id, setHead]);

  const list = useMemo(() => tpl.sections.flatMap((s) => s.items.map((it) => items[it.key] ?? { key: it.key, score: null })), [tpl, items]);
  const { score, max, percent } = assessmentScore(type, list);
  const answered = list.filter((i) => i.score !== null).length;

  const setScore = (key: string, s: number | null) => setItems({ ...items, [key]: { ...(items[key] ?? { key }), key, score: s } });
  const setNote = (key: string, note: string) => setItems({ ...items, [key]: { ...(items[key] ?? { key, score: null }), key, note } });

  const save = async () => {
    if (!head.patientId) return toast.error("بیمار را انتخاب کنید");
    setLoading(true);
    try {
      const payload = { patientId: head.patientId, therapistId: head.therapistId || undefined, type, date: head.date?.toISOString(), items: list, summary, recommendations, visibleToPatient: head.visibleToPatient };
      const r = id ? await api.patch<{ form: any }>(`/forms/assessments/${id}`, payload) : await api.post<{ form: any }>("/forms/assessments", payload);
      toast.success("ارزیابی ذخیره شد");
      if (!id) router.replace(`/panel/forms/assessments/${r.form.id}`);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const remove = async () => { if (!(await confirm("این ارزیابی حذف شود؟"))) return; await api.delete(`/forms/assessments/${id}`); toast.success("حذف شد"); router.push("/panel/forms/assessments"); };
  if (!loaded) return null;

  return (
    <div className="space-y-5">
      {dialog}
      <Card title="مشخصات ارزیابی">
        <FormHeaderFields value={head} onChange={setHead} locked={!!id} />
        {!id && <div className="mt-4"><label className="label">نوع ارزیابی</label><Tabs value={type} onChange={(t) => { setType(t); setItems({}); }} tabs={ASSESSMENT_TYPES.map((t) => ({ key: t, label: ASSESSMENT_TEMPLATES[t].title }))} /></div>}
      </Card>

      <div className="sticky top-[61px] z-20 rounded-2xl border border-sand-200 bg-white/95 p-4 shadow-soft backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-bold">{tpl.title}</h3><p className="text-xs text-slate-400">{tpl.description}</p></div>
          <div className="flex items-center gap-4">
            <span className="num text-xs text-slate-500">{toPersianDigits(answered)} از {toPersianDigits(list.length)} آیتم</span>
            <div className="w-40"><ProgressBar value={percent} tone={TONES[type]} /></div>
            <span className={cn("num text-2xl font-black", `text-${TONES[type]}-600`)}>{toPersianDigits(percent)}٪</span>
            <span className="num text-xs text-slate-400">({toPersianDigits(score)}/{toPersianDigits(max)})</span>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400"><Info className="h-3 w-3" />امتیاز ۰ = وابسته کامل تا ۴ = مستقل/طبیعی. برای هر آیتم می‌توانید یادداشت بنویسید.</p>
      </div>

      {tpl.sections.map((sec) => (
        <Card key={sec.title} title={sec.title} padded={false}>
          <div className="divide-y divide-sand-100">
            {sec.items.map((it) => {
              const val = items[it.key];
              return (
                <div key={it.key} className="grid gap-3 px-5 py-3 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-4"><p className="text-sm font-medium">{it.label}</p>{it.hint && <p className="text-xs text-slate-400">{it.hint}</p>}</div>
                  <div className="flex gap-1 md:col-span-4">
                    {[0, 1, 2, 3, 4].map((s) => (
                      <button key={s} type="button" disabled={readOnly} title={SCORE_LABELS[s]} onClick={() => setScore(it.key, val?.score === s ? null : s)} className={cn("num h-9 flex-1 rounded-xl border text-sm font-bold transition", val?.score === s ? `border-${TONES[type]}-600 bg-${TONES[type]}-600 text-white` : "border-sand-300 bg-white hover:border-brand-300 disabled:opacity-60")}>{toPersianDigits(s)}</button>
                    ))}
                  </div>
                  <input value={val?.note ?? ""} disabled={readOnly} onChange={(e) => setNote(it.key, e.target.value)} placeholder="یادداشت..." className="input py-1.5 text-xs md:col-span-4" />
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <Card title="جمع‌بندی">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="خلاصه و تحلیل"><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} disabled={readOnly} /></Field>
          <Field label="توصیه‌ها و برنامه"><Textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} rows={4} disabled={readOnly} /></Field>
        </div>
      </Card>
      <div className="no-print flex flex-wrap justify-end gap-2">
        {id && <Button variant="ghost" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ</Button>}
        {id && !readOnly && <Button variant="ghost" className="text-coral-600" onClick={remove} icon={<Trash2 className="h-4 w-4" />}>حذف</Button>}
        {!readOnly && <Button loading={loading} onClick={save} icon={<Save className="h-4 w-4" />}>ذخیره ارزیابی</Button>}
      </div>
    </div>
  );
}

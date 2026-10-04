"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, Printer, Save, CheckCircle2, Trash2, Link2 } from "lucide-react";
import { QUESTIONNAIRES, QUESTIONNAIRE_SOURCE_LABELS, QUESTIONNAIRE_STATUS_LABELS, formatJalaliDateTime, toPersianDigits, type QuestionnaireType } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, Field, PageHeader, Spinner, Textarea, Toggle, useConfirm } from "@/components/ui";
import { cn } from "@/lib/utils";

function Bar({ score, max, tone = "bg-brand-600" }: { score: number; max: number; tone?: string }) {
  const pct = max ? Math.round((score / max) * 100) : 0;
  return <div className="h-2 w-full overflow-hidden rounded-full bg-sand-200"><div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} /></div>;
}
const QUAD_TONES: Record<string, string> = { seeking: "bg-sage-500", avoiding: "bg-coral-500", sensitivity: "bg-amber-400", registration: "bg-violet-500" };

/** تحلیل آزمون: جمع هر حوزه و ربع حسی، پاسخ‌ها و نوشتن تحلیل کاردرمانگر */
export default function QuestionnaireDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["questionnaire", id], queryFn: () => api.get<{ item: any; canAnalyze: boolean; phoneMatch: any }>(`/questionnaires/${id}`) });
  const [analysis, setAnalysis] = useState("");
  const [share, setShare] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) { setAnalysis(data.item.analysis ?? ""); setShare(!!data.item.shareWithPatient); } }, [data]);
  if (isLoading || !data) return <Spinner />;
  const q = data.item;
  const def = QUESTIONNAIRES[q.type as QuestionnaireType];
  const labelOf = (v: number) => def.scale.find((x) => x.value === v)?.label ?? "-";
  const refresh = () => { qc.invalidateQueries({ queryKey: ["questionnaire", id] }); qc.invalidateQueries({ queryKey: ["questionnaires"] }); };

  const save = async (finalize: boolean) => {
    setSaving(true);
    try {
      await api.patch(`/questionnaires/${id}/analysis`, { analysis, shareWithPatient: share, finalize });
      toast.success(finalize ? "تحلیل ثبت شد" + (share && q.patient ? "؛ برای مراجع قابل مشاهده است" : "") : "پیش‌نویس ذخیره شد");
      refresh();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  const link = async () => { try { await api.post(`/questionnaires/${id}/link`, { patientId: data.phoneMatch.id }); toast.success("به پرونده متصل شد"); refresh(); } catch (e: any) { toast.error(e.message); } };
  const remove = async () => { if (!(await confirm("این پرسشنامه حذف شود؟ قابل بازگشت نیست."))) return; await api.delete(`/questionnaires/${id}`); toast.success("حذف شد"); router.push("/panel/questionnaires"); };
  const who = q.patient ? q.patient.fullName : q.subjectName ?? q.respondentName ?? "—";

  return (
    <div className="space-y-5">
      {dialog}
      <PageHeader title={`${def.title} — ${who}`} subtitle={`${QUESTIONNAIRE_SOURCE_LABELS[q.source] ?? q.source} · ${QUESTIONNAIRE_STATUS_LABELS[q.status]}`} icon={<ClipboardCheck className="h-5 w-5" />} actions={<><Button variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ</Button>{user?.role === "ADMIN" && <Button variant="ghost" className="text-coral-600" onClick={remove} icon={<Trash2 className="h-4 w-4" />}>حذف</Button>}</>} />

      <Card>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-slate-400">مراجع</dt><dd className="font-medium">{q.patient ? <Link href={`/panel/patients/${q.patient.id}`} className="text-brand-700 hover:underline">{q.patient.fullName} <span className="num text-xs text-slate-400">{q.patient.fileNumber}</span></Link> : "ثبت‌نشده در پرونده (مهمان سایت)"}</dd></div>
          <div><dt className="text-xs text-slate-400">کودک / سن</dt><dd>{q.subjectName ?? "-"}{q.subjectAge ? ` · ${q.subjectAge}` : ""}</dd></div>
          <div><dt className="text-xs text-slate-400">تکمیل‌کننده</dt><dd>{q.respondentName ?? "-"}{q.respondentPhone && <span className="num mr-1 text-xs text-slate-500" dir="ltr">{toPersianDigits(q.respondentPhone)}</span>}</dd></div>
          <div><dt className="text-xs text-slate-400">تاریخ تکمیل</dt><dd className="num">{formatJalaliDateTime(q.submittedAt)}</dd></div>
          {q.approvedBy && <div><dt className="text-xs text-slate-400">تأیید ارسال</dt><dd>{q.approvedBy}</dd></div>}
          {q.analyzedBy && <div><dt className="text-xs text-slate-400">تحلیل</dt><dd>{q.analyzedBy} · <span className="num">{formatJalaliDateTime(q.analyzedAt)}</span></dd></div>}
          {q.patient?.therapistName && <div><dt className="text-xs text-slate-400">درمانگر اصلی</dt><dd>{q.patient.therapistName}</dd></div>}
          {q.leadId && <div><dt className="text-xs text-slate-400">CRM</dt><dd><Link href={`/panel/leads/${q.leadId}`} className="text-brand-700 hover:underline">مشاهده لید</Link></dd></div>}
        </dl>
        {!q.patient && data.phoneMatch && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm"><Link2 className="h-4 w-4 text-brand-700" />شماره تکمیل‌کننده با پرونده <b>{data.phoneMatch.fullName}</b> <span className="num text-xs">{data.phoneMatch.fileNumber}</span> یکی است.<Button size="sm" variant="secondary" onClick={link}>اتصال به این پرونده</Button></div>
        )}
      </Card>

      {q.scores && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="ربع‌های حسی" subtitle="جمع نمره سؤال‌های هر ربع طبق جدول فرم (هر سؤال ۰ تا ۵)">
            <div className="space-y-4">
              {q.scores.quadrants.map((r: any) => (
                <div key={r.key}>
                  <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium">{r.title}</span><span className="text-xs text-slate-400"><b className="num text-sm text-slate-800">{toPersianDigits(r.score)}</b> از <span className="num">{toPersianDigits(r.max)}</span> <span className="text-[10px]">(<span className="num">{toPersianDigits(r.count)}</span> سؤال)</span></span></div>
                  <Bar score={r.score} max={r.max} tone={QUAD_TONES[r.key]} />
                  <p className="mt-1 text-[11px] text-slate-400">{def.quadrants.find((x) => x.key === r.key)?.description}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="جمع نمرات حوزه‌ها" padded={false}>
            <table className="table">
              <thead><tr><th>حوزه</th><th>نمره</th><th className="w-1/3"></th></tr></thead>
              <tbody>{q.scores.sections.map((r: any) => <tr key={r.key}><td>{r.title}</td><td className="num whitespace-nowrap font-bold">{toPersianDigits(r.score)} <span className="text-xs font-normal text-slate-400">/ {toPersianDigits(r.max)}</span></td><td><Bar score={r.score} max={r.max} /></td></tr>)}</tbody>
              <tfoot><tr className="bg-sand-50 font-bold"><td>جمع کل</td><td className="num">{toPersianDigits(q.scores.total)} <span className="text-xs font-normal text-slate-400">/ {toPersianDigits(q.scores.max)}</span></td><td /></tr></tfoot>
            </table>
          </Card>
        </div>
      )}

      <Card title="تحلیل کاردرمانگر" subtitle={data.canAnalyze ? "تحلیل و توصیه‌ها را بنویسید. فقط وقتی «نمایش برای مراجع» روشن باشد، مراجع نتیجه را در پنل خود می‌بیند." : "فقط مدیر و کاربران دارای دسترسی «تحلیل آزمون‌ها» می‌توانند تحلیل بنویسند."}>
        {data.canAnalyze ? (
          <div className="space-y-3">
            <Field label="تحلیل و توصیه‌ها"><Textarea value={analysis} onChange={(e) => setAnalysis(e.target.value)} rows={8} placeholder="الگوی پاسخ‌های حسی، حوزه‌های قابل توجه، توصیه برای ارزیابی حضوری یا برنامه درمانی..." /></Field>
            {q.patient ? <Toggle checked={share} onChange={setShare} label="نمایش نتیجه و تحلیل برای مراجع در پنل او" /> : <p className="text-xs text-slate-500">این پاسخ به پرونده‌ای متصل نیست؛ نتیجه را تلفنی به تکمیل‌کننده اعلام کنید.</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" loading={saving} onClick={() => save(false)} icon={<Save className="h-4 w-4" />}>ذخیره پیش‌نویس</Button>
              <Button loading={saving} onClick={() => save(true)} icon={<CheckCircle2 className="h-4 w-4" />}>{q.status === "ANALYZED" ? "به‌روزرسانی تحلیل" : "ثبت نهایی تحلیل"}</Button>
            </div>
          </div>
        ) : <p className="whitespace-pre-line text-sm leading-8 text-slate-700">{q.analysis || "هنوز تحلیلی ثبت نشده است."}</p>}
      </Card>

      {q.answers && (
        <Card title="پاسخ‌ها" padded={false}>
          {def.sections.map((sec) => (
            <div key={sec.key}>
              <h4 className="bg-sand-100 px-5 py-2 text-sm font-bold text-brand-800">{sec.title}</h4>
              <ul className="divide-y divide-sand-100">
                {sec.items.map((it) => { const v = q.answers[String(it.no)]; return (
                  <li key={it.no} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="leading-7"><span className="num ml-1 text-xs text-slate-400">{toPersianDigits(it.no)}.</span>{it.text}</span>
                    <span className={cn("shrink-0 whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-medium", v >= 4 ? "bg-coral-500/10 text-coral-700" : v >= 2 ? "bg-amber-400/15 text-amber-700" : "bg-sand-100 text-slate-500")}>{labelOf(v)} <span className="num">({toPersianDigits(v)})</span></span>
                  </li>
                ); })}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

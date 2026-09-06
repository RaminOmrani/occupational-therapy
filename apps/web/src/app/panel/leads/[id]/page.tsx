"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, Pencil, MessageSquareText, ArrowLeft, PhoneCall, StickyNote, Trash2 } from "lucide-react";
import { LEAD_SOURCE_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS, formatJalali, formatJalaliDateTime, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Button, Card, Field, PageHeader, Spinner, Textarea, useConfirm } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LeadModal } from "@/components/crm/LeadModal";
import { cn } from "@/lib/utils";

export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["lead", id], queryFn: () => api.get<any>(`/leads/${id}`) });
  const [edit, setEdit] = useState(false);
  const [note, setNote] = useState("");
  const [smsText, setSmsText] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["lead", id] });
  if (isLoading || !data) return <Spinner />;
  const l = data.lead;
  const addActivity = async (type: string, content: string) => { if (!content.trim()) return; await api.post(`/leads/${id}/activities`, { type, content }); setNote(""); refresh(); };
  const setStatus = async (status: string) => { await api.patch(`/leads/${id}`, { status }); refresh(); };
  const sendSms = async (useTemplate: boolean) => {
    try { await api.post(`/leads/${id}/sms`, useTemplate ? {} : { message: smsText }); toast.success("پیامک ارسال شد"); setSmsText(""); refresh(); } catch (e: any) { toast.error(e.message); }
  };
  const remove = async () => { if (!(await confirm("این لید حذف شود؟"))) return; await api.delete(`/leads/${id}`); window.location.href = "/panel/leads"; };

  return (
    <>
      {dialog}
      <PageHeader title={`${l.firstName} ${l.lastName}`.trim()} subtitle={<span className="num">لید {l.leadNumber} · {LEAD_SOURCE_LABELS[l.source as keyof typeof LEAD_SOURCE_LABELS]} · ثبت {formatJalali(l.createdAt)}</span>} actions={<>
        <Button variant="secondary" onClick={() => setEdit(true)} icon={<Pencil className="h-4 w-4" />}>ویرایش</Button>
        {l.patient ? <Link href={`/panel/patients/${l.patient.id}`} className="btn-secondary">پرونده {l.patient.fileNumber}</Link> : <Link href={`/panel/patients/new?leadId=${l.id}`} className="btn-primary">تبدیل به بیمار<ArrowLeft className="h-4 w-4" /></Link>}
      </>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="مسیر فروش">
            <div className="flex flex-wrap gap-2">
              {LEAD_STATUSES.map((s) => <button key={s} onClick={() => setStatus(s)} className={cn("rounded-xl border px-3 py-1.5 text-sm transition", l.status === s ? "border-brand-600 bg-brand-600 text-white" : "border-sand-300 bg-white hover:border-brand-300")}>{LEAD_STATUS_LABELS[s]}</button>)}
            </div>
          </Card>
          <Card title="یادداشت و فعالیت">
            <div className="flex gap-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="خلاصه تماس، نکات مهم..." className="min-h-[60px]" />
              <div className="flex flex-col gap-1">
                <Button size="sm" onClick={() => addActivity("CALL", note)} icon={<PhoneCall className="h-4 w-4" />}>تماس</Button>
                <Button size="sm" variant="secondary" onClick={() => addActivity("NOTE", note)} icon={<StickyNote className="h-4 w-4" />}>یادداشت</Button>
              </div>
            </div>
            <ul className="mt-5 space-y-3 border-r-2 border-sand-200 pr-4">
              {l.activities.map((a: any) => (
                <li key={a.id} className="relative text-sm">
                  <span className={cn("absolute -right-[23px] top-1.5 h-3 w-3 rounded-full", a.type === "CALL" ? "bg-brand-500" : a.type === "SMS" ? "bg-amber-400" : a.type === "STATUS" ? "bg-violet-500" : "bg-sand-400")} />
                  <p className="leading-6">{a.content}</p>
                  <p className="text-xs text-slate-400">{formatJalaliDateTime(a.createdAt)}{a.byName ? ` · ${a.byName}` : ""}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="اطلاعات">
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-slate-400">موبایل</dt><dd><a href={`tel:${l.phone}`} className="num flex items-center gap-1 text-brand-700" dir="ltr"><Phone className="h-3.5 w-3.5" />{toPersianDigits(l.phone)}</a></dd></div>
              <div><dt className="text-xs text-slate-400">وضعیت</dt><dd><StatusBadge status={l.status} /></dd></div>
              <div><dt className="text-xs text-slate-400">علاقه‌مندی</dt><dd>{l.interest ?? "-"}</dd></div>
              <div><dt className="text-xs text-slate-400">پیگیری بعدی</dt><dd className="num">{l.followUpAt ? formatJalali(l.followUpAt) : "-"}</dd></div>
              <div><dt className="text-xs text-slate-400">مسئول</dt><dd>{l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : "-"}</dd></div>
              {l.notes && <div><dt className="text-xs text-slate-400">یادداشت</dt><dd className="leading-6">{l.notes}</dd></div>}
            </dl>
            <button onClick={remove} className="mt-4 flex items-center gap-1 text-xs text-coral-600 hover:underline"><Trash2 className="h-3.5 w-3.5" />حذف لید</button>
          </Card>
          <Card title="پیامک" actions={<MessageSquareText className="h-4 w-4 text-slate-400" />}>
            <Button variant="secondary" size="sm" className="w-full" onClick={() => sendSms(true)}>ارسال الگوی «پیگیری لید»</Button>
            <Field label="یا متن دلخواه" className="mt-3"><Textarea value={smsText} onChange={(e) => setSmsText(e.target.value)} className="min-h-[70px]" /></Field>
            <Button size="sm" className="mt-2 w-full" disabled={!smsText.trim()} onClick={() => sendSms(false)}>ارسال</Button>
            {data.sms.length > 0 && <ul className="mt-4 space-y-2 text-xs">{data.sms.map((s: any) => <li key={s.id} className="rounded-xl bg-sand-100 p-2"><div className="flex justify-between"><StatusBadge status={s.status} /><span className="text-slate-400">{formatJalaliDateTime(s.createdAt)}</span></div><p className="mt-1 line-clamp-2 text-slate-600">{s.body}</p></li>)}</ul>}
          </Card>
        </div>
      </div>
      {edit && <LeadModal lead={l} onClose={() => setEdit(false)} onDone={() => { setEdit(false); refresh(); }} />}
    </>
  );
}

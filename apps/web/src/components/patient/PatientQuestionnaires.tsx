"use client";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, Send } from "lucide-react";
import { QUESTIONNAIRE_STATUS_LABELS, formatJalali, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Button, Card, useConfirm } from "@/components/ui";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = { PENDING_APPROVAL: "bg-amber-400/15 text-amber-700", ASSIGNED: "bg-violet-100 text-violet-700", SUBMITTED: "bg-coral-500/10 text-coral-700", ANALYZED: "bg-sage-100 text-sage-700", DECLINED: "bg-sand-200 text-slate-500" };

/** کارت پرسشنامه‌های مراجع در پرونده (کارکنان): وضعیت، لینک تحلیل و ارسال پروفایل حسی */
export function PatientQuestionnaires({ patientId, canApprove }: { patientId: string; canApprove: boolean }) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const { data } = useQuery({ queryKey: ["questionnaires", "patient", patientId], queryFn: () => api.get<{ items: any[] }>("/questionnaires", { patientId }) });
  const items = data?.items ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["questionnaires"] });
  const hasOpen = items.some((q) => q.status === "ASSIGNED");
  const send = async () => {
    if (!(await confirm("پرسشنامه پروفایل حسی برای این مراجع ارسال شود؟ پیامک و اعلان برای مراجع، مدیر، منشی و درمانگر می‌رود."))) return;
    try { await api.post("/questionnaires/send", { patientId }); toast.success("ارسال شد"); refresh(); } catch (e: any) { toast.error(e.message); }
  };
  const approve = async (id: string) => { try { await api.post(`/questionnaires/${id}/approve`); toast.success("ارسال شد"); refresh(); } catch (e: any) { toast.error(e.message); } };
  return (
    <Card title="پرسشنامه‌ها" actions={<ClipboardCheck className="h-4 w-4 text-slate-400" />}>
      {dialog}
      {items.length ? (
        <ul className="space-y-2 text-sm">
          {items.map((q) => (
            <li key={q.id} className="rounded-xl bg-sand-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{q.title}</span>
                <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium", TONE[q.status])}>{QUESTIONNAIRE_STATUS_LABELS[q.status]}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span className="num">{formatJalali(q.submittedAt ?? q.approvedAt ?? q.createdAt)}{q.scores ? ` · جمع ${toPersianDigits(q.scores.total)}` : ""}</span>
                {q.status === "PENDING_APPROVAL" && canApprove ? <button onClick={() => approve(q.id)} className="font-medium text-brand-600 hover:underline">تأیید و ارسال</button> : ["SUBMITTED", "ANALYZED"].includes(q.status) ? <Link href={`/panel/questionnaires/${q.id}`} className="font-medium text-brand-600 hover:underline">مشاهده / تحلیل</Link> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-400">پرسشنامه‌ای ثبت نشده</p>}
      {!hasOpen && <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={send} icon={<Send className="h-4 w-4" />}>ارسال پرسشنامه پروفایل حسی</Button>}
    </Card>
  );
}

"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, Check, X, ExternalLink } from "lucide-react";
import { QUESTIONNAIRE_SOURCE_LABELS, QUESTIONNAIRE_STATUS_LABELS, formatJalali, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, EmptyState, PageHeader, Spinner, Tabs, useConfirm } from "@/components/ui";
import { cn } from "@/lib/utils";

const TABS = ["PENDING_APPROVAL", "ASSIGNED", "SUBMITTED", "ANALYZED", "DECLINED"] as const;
const TAB_LABELS: Record<string, string> = { PENDING_APPROVAL: "در انتظار تأیید", ASSIGNED: "منتظر تکمیل", SUBMITTED: "منتظر تحلیل", ANALYZED: "تحلیل‌شده", DECLINED: "ارسال نشد" };
const STATUS_TONE: Record<string, string> = { PENDING_APPROVAL: "bg-amber-400/15 text-amber-700", ASSIGNED: "bg-violet-100 text-violet-700", SUBMITTED: "bg-coral-500/10 text-coral-700", ANALYZED: "bg-sage-100 text-sage-700", DECLINED: "bg-sand-200 text-slate-500" };

function Inner() {
  const sp = useSearchParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const canApprove = user?.role === "ADMIN" || user?.role === "SECRETARY";
  const [tab, setTab] = useState<string>(sp.get("tab") ?? (canApprove ? "PENDING_APPROVAL" : "SUBMITTED"));
  const { data, isLoading } = useQuery({ queryKey: ["questionnaires", tab], queryFn: () => api.get<{ items: any[]; counts: Record<string, number>; canAnalyze: boolean }>("/questionnaires", { status: tab }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["questionnaires"] });
  const approve = async (q: any) => { try { await api.post(`/questionnaires/${q.id}/approve`); toast.success("پرسشنامه برای مراجع ارسال شد؛ پیامک و اعلان رفت"); refresh(); } catch (e: any) { toast.error(e.message); } };
  const decline = async (q: any) => { if (!(await confirm(`برای ${q.patient?.fullName ?? "این مراجع"} پرسشنامه ارسال نشود؟`))) return; try { await api.post(`/questionnaires/${q.id}/decline`); toast.success("ثبت شد"); refresh(); } catch (e: any) { toast.error(e.message); } };
  const counts = data?.counts ?? {};
  const who = (q: any) => q.patient ? q.patient.fullName : q.subjectName ? `${q.subjectName}${q.respondentName ? ` (والد: ${q.respondentName})` : ""}` : q.respondentName ?? "—";
  return (
    <>
      {dialog}
      <PageHeader title="پرسشنامه‌ها و تحلیل آزمون" subtitle="تأیید ارسال پرسشنامه برای مراجعین جدید، پیگیری تکمیل و تحلیل پروفایل حسی" icon={<ClipboardCheck className="h-5 w-5" />} actions={<Link href="/tests/sensory-profile" target="_blank" className="btn-ghost"><ExternalLink className="h-4 w-4" />صفحه عمومی آزمون</Link>} />
      <Tabs value={tab} onChange={setTab} className="mb-4" tabs={TABS.map((t) => ({ key: t, label: TAB_LABELS[t], count: counts[t] ?? 0 }))} />
      <Card padded={false} className="overflow-x-auto">
        {isLoading ? <Spinner /> : data?.items.length ? (
          <table className="table">
            <thead><tr><th>مراجع / کودک</th><th>پرونده</th><th>پرسشنامه</th><th>منبع</th><th>تاریخ</th><th>وضعیت</th><th></th></tr></thead>
            <tbody>{data.items.map((q) => (
              <tr key={q.id}>
                <td className="font-medium">{q.patient ? <Link href={`/panel/patients/${q.patient.id}`} className="hover:text-brand-700">{who(q)}</Link> : who(q)}{q.patient?.therapistName && <span className="block text-[11px] text-slate-400">درمانگر: {q.patient.therapistName}</span>}{!q.patient && q.respondentPhone && <span className="num block text-[11px] text-slate-400" dir="ltr">{toPersianDigits(q.respondentPhone)}</span>}</td>
                <td className="num text-xs">{q.patient?.fileNumber ?? "-"}</td>
                <td className="text-xs">{q.title}</td>
                <td className="text-xs">{QUESTIONNAIRE_SOURCE_LABELS[q.source] ?? q.source}</td>
                <td className="num text-xs">{formatJalali(q.submittedAt ?? q.approvedAt ?? q.createdAt)}</td>
                <td><span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_TONE[q.status])}>{QUESTIONNAIRE_STATUS_LABELS[q.status]}</span></td>
                <td className="whitespace-nowrap">
                  {q.status === "PENDING_APPROVAL" && canApprove ? (
                    <span className="flex gap-1"><Button size="sm" onClick={() => approve(q)} icon={<Check className="h-4 w-4" />}>تأیید و ارسال</Button><Button size="sm" variant="secondary" onClick={() => decline(q)} icon={<X className="h-4 w-4" />}>نه</Button></span>
                  ) : ["SUBMITTED", "ANALYZED"].includes(q.status) ? (
                    <Link href={`/panel/questionnaires/${q.id}`} className="text-xs font-medium text-brand-600 hover:underline">{q.status === "SUBMITTED" && data.canAnalyze ? "تحلیل آزمون" : "مشاهده"}</Link>
                  ) : null}
                </td>
              </tr>
            ))}</tbody>
          </table>
        ) : <EmptyState title="موردی نیست" description={tab === "PENDING_APPROVAL" ? "با ثبت هر مراجع جدید یا جلسه ارزیابی، اینجا از شما پرسیده می‌شود که پرسشنامه برایش ارسال شود یا نه." : undefined} />}
      </Card>
    </>
  );
}

export default function QuestionnairesPage() {
  return <Suspense><Inner /></Suspense>;
}

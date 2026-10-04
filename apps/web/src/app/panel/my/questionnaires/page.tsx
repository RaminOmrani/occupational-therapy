"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ChevronLeft } from "lucide-react";
import { QUESTIONNAIRE_STATUS_LABELS, SENSORY_PROFILE_2, formatJalali, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = { ASSIGNED: "bg-amber-400/15 text-amber-700", SUBMITTED: "bg-brand-50 text-brand-700", ANALYZED: "bg-sage-100 text-sage-700" };

/** پرسشنامه‌های مراجع: ارسال‌شده از کلینیک (برای تکمیل) و نتیجه‌های تحلیل‌شده */
export default function MyQuestionnairesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["my-questionnaires"], queryFn: () => api.get<{ items: any[] }>("/questionnaires/my") });
  const items = data?.items ?? [];
  const pending = items.filter((x) => x.status === "ASSIGNED");
  return (
    <>
      <PageHeader title="پرسشنامه‌ها" subtitle="پرسشنامه‌هایی که کلینیک برای شما فرستاده و نتیجه بررسی آن‌ها" icon={<ClipboardCheck className="h-5 w-5" />} />
      {isLoading ? <Spinner /> : (
        <div className="space-y-4">
          {pending.map((q) => (
            <Card key={q.id} className="border-amber-400/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-bold text-brand-900">{q.title}</h3><p className="mt-1 text-xs text-slate-500">ارسال‌شده در {formatJalali(q.approvedAt ?? q.createdAt)}؛ لطفاً تکمیل کنید</p></div>
                <Link href={`/panel/my/questionnaires/${q.id}`} className="btn-primary">تکمیل پرسشنامه <ChevronLeft className="h-4 w-4" /></Link>
              </div>
            </Card>
          ))}
          {items.filter((x) => x.status !== "ASSIGNED").map((q) => (
            <Card key={q.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-bold">{q.title}</h3><p className="mt-1 text-xs text-slate-500">تکمیل‌شده در {formatJalali(q.submittedAt)}</p></div>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", TONE[q.status] ?? "bg-sand-100 text-slate-600")}>{q.status === "ANALYZED" && !q.analysis ? "بررسی شد" : QUESTIONNAIRE_STATUS_LABELS[q.status]}</span>
              </div>
              {q.analysis && (
                <div className="mt-4 rounded-2xl bg-sage-50 p-4">
                  <p className="mb-2 text-xs font-bold text-sage-700">نتیجه بررسی کاردرمانگر</p>
                  <p className="whitespace-pre-line text-sm leading-8 text-slate-700">{q.analysis}</p>
                </div>
              )}
              {q.scores && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {q.scores.quadrants.map((r: any) => <div key={r.key} className="rounded-xl bg-sand-100 px-3 py-2 text-xs"><p className="text-slate-500">{r.title}</p><p className="num mt-0.5 font-bold">{toPersianDigits(r.score)} <span className="text-[10px] font-normal text-slate-400">از {toPersianDigits(r.max)}</span></p></div>)}
                </div>
              )}
            </Card>
          ))}
          {!items.length && <EmptyState title="پرسشنامه‌ای برای شما ارسال نشده" description="اگر کاردرمانگر پرسشنامه‌ای برای شما بفرستد، اینجا نمایش داده می‌شود." />}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-bold">{SENSORY_PROFILE_2.title}</h3><p className="mt-1 text-xs leading-6 text-slate-500">اگر مایلید الگوی پاسخ‌های حسی فرزندتان را بهتر بشناسید، می‌توانید این پرسشنامه را تکمیل کنید تا در پرونده ثبت و توسط کاردرمانگر بررسی شود.</p></div>
              <Link href="/panel/my/questionnaires/new" className="btn-secondary">تکمیل پروفایل حسی</Link>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

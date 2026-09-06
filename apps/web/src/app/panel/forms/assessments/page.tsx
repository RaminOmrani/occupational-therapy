"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Activity, Eye } from "lucide-react";
import { ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS, formatJalali, toPersianDigits, type AssessmentType } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, EmptyState, PageHeader, ProgressBar, Select, Spinner, Badge } from "@/components/ui";
import { FormFilters, filterParams, type FormFilterState } from "@/components/forms/FormFilters";

export default function AssessmentsListPage() {
  const { user } = useAuth();
  const [f, setF] = useState<FormFilterState>({ q: "", therapistId: "", from: null, to: null, type: "" });
  const { data, isLoading } = useQuery({ queryKey: ["assessments", f], queryFn: () => api.get<{ items: any[] }>("/forms/assessments", { ...filterParams(f), all: 1 }), placeholderData: (p) => p });
  const tone = (t: AssessmentType) => (t === "PHYSICAL" ? "brand" : t === "PERCEPTUAL_MOTOR" ? "amber" : "violet");
  return (
    <>
      <PageHeader title="ارزیابی‌ها" subtitle="پروفایل جسمی، مهارت‌های ادراکی-حرکتی و شناختی" icon={<Activity className="h-5 w-5" />} actions={user?.role !== "SECRETARY" && <Link href="/panel/forms/assessments/new" className="btn-primary"><Plus className="h-4 w-4" />ارزیابی جدید</Link>} />
      <FormFilters value={f} onChange={setF} extra={<Select value={f.type ?? ""} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">همه انواع</option>{ASSESSMENT_TYPES.map((t) => <option key={t} value={t}>{ASSESSMENT_TYPE_LABELS[t]}</option>)}</Select>} />
      <Card padded={false} className="overflow-x-auto">
        {isLoading && !data ? <Spinner /> : data?.items.length ? (
          <table className="table">
            <thead><tr><th>تاریخ</th><th>بیمار</th><th>نوع</th><th className="w-48">امتیاز</th><th>درمانگر</th><th>خلاصه</th><th></th></tr></thead>
            <tbody>{data.items.map((i) => { const pct = i.maxScore ? Math.round((i.score / i.maxScore) * 100) : 0; return (
              <tr key={i.id}><td className="num">{formatJalali(i.date)}</td><td><Link href={`/panel/patients/${i.patientId}?tab=records`} className="font-medium hover:text-brand-700">{i.patientName}</Link><span className="mr-1 num text-xs text-slate-400">{i.patient.fileNumber}</span></td><td><Badge tone={tone(i.type)}>{ASSESSMENT_TYPE_LABELS[i.type as AssessmentType]}</Badge></td><td><div className="flex items-center gap-2"><ProgressBar value={pct} tone={tone(i.type)} className="flex-1" /><span className="num w-10 text-xs font-bold">{toPersianDigits(pct)}٪</span></div></td><td className="text-xs">{i.therapistName}</td><td className="max-w-[200px] truncate text-xs text-slate-500">{i.summary ?? "-"}</td><td><Link href={`/panel/forms/assessments/${i.id}`} className="text-brand-600"><Eye className="h-4 w-4" /></Link></td></tr>
            ); })}</tbody>
          </table>
        ) : <EmptyState title="ارزیابی‌ای یافت نشد" icon={<Activity className="h-6 w-6" />} />}
      </Card>
    </>
  );
}

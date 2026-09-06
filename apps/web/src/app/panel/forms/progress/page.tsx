"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, TrendingUp, Eye } from "lucide-react";
import { formatJalali, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { FormFilters, filterParams, type FormFilterState } from "@/components/forms/FormFilters";

export default function ProgressListPage() {
  const { user } = useAuth();
  const [f, setF] = useState<FormFilterState>({ q: "", therapistId: "", from: null, to: null });
  const { data, isLoading } = useQuery({ queryKey: ["progress", f], queryFn: () => api.get<{ items: any[] }>("/forms/progress", { ...filterParams(f), all: 1 }), placeholderData: (p) => p });
  return (
    <>
      <PageHeader title="گزارش پیشرفت مراجعان" subtitle="گزارش هر جلسه درمانی (SOAP)" icon={<TrendingUp className="h-5 w-5" />} actions={user?.role !== "SECRETARY" && <Link href="/panel/forms/progress/new" className="btn-primary"><Plus className="h-4 w-4" />گزارش جدید</Link>} />
      <FormFilters value={f} onChange={setF} />
      <Card padded={false} className="overflow-x-auto">
        {isLoading && !data ? <Spinner /> : data?.items.length ? (
          <table className="table">
            <thead><tr><th>تاریخ</th><th>بیمار</th><th>جلسه</th><th>پیشرفت</th><th>همکاری</th><th>فعالیت‌ها</th><th>درمانگر</th><th></th></tr></thead>
            <tbody>{data.items.map((i) => (
              <tr key={i.id}><td className="num">{formatJalali(i.date)}</td><td><Link href={`/panel/patients/${i.patientId}?tab=records`} className="font-medium hover:text-brand-700">{i.patientName}</Link></td><td className="num">{toPersianDigits(i.sessionNumber ?? "-")}</td><td className="num">{i.progressScore ? `${toPersianDigits(i.progressScore)}/۱۰` : "-"}</td><td className="num">{i.cooperation ? `${toPersianDigits(i.cooperation)}/۵` : "-"}</td><td className="max-w-xs truncate text-xs text-slate-500">{i.activities ?? i.assessment ?? "-"}</td><td className="text-xs">{i.therapistName}</td><td><Link href={`/panel/forms/progress/${i.id}`} className="text-brand-600"><Eye className="h-4 w-4" /></Link></td></tr>
            ))}</tbody>
          </table>
        ) : <EmptyState title="گزارشی یافت نشد" icon={<TrendingUp className="h-6 w-6" />} />}
      </Card>
    </>
  );
}

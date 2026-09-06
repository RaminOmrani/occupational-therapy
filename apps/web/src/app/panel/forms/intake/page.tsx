"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, ClipboardList, Eye } from "lucide-react";
import { formatJalali } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { FormFilters, filterParams, type FormFilterState } from "@/components/forms/FormFilters";

export default function IntakeListPage() {
  const { user } = useAuth();
  const [f, setF] = useState<FormFilterState>({ q: "", therapistId: "", from: null, to: null });
  const { data, isLoading } = useQuery({ queryKey: ["intake", f], queryFn: () => api.get<{ items: any[] }>("/forms/intake", { ...filterParams(f), all: 1 }), placeholderData: (p) => p });
  return (
    <>
      <PageHeader title="شرح حال اولیه" subtitle="فرم پذیرش و تاریخچه هر مراجع" icon={<ClipboardList className="h-5 w-5" />} actions={user?.role !== "SECRETARY" && <Link href="/panel/forms/intake/new" className="btn-primary"><Plus className="h-4 w-4" />شرح حال جدید</Link>} />
      <FormFilters value={f} onChange={setF} />
      <Card padded={false} className="overflow-x-auto">
        {isLoading && !data ? <Spinner /> : data?.items.length ? (
          <table className="table">
            <thead><tr><th>تاریخ</th><th>بیمار</th><th>شکایت اصلی</th><th>تشخیص</th><th>درمانگر</th><th></th></tr></thead>
            <tbody>{data.items.map((i) => (
              <tr key={i.id}><td className="num">{formatJalali(i.date)}</td><td><Link href={`/panel/patients/${i.patientId}?tab=records`} className="font-medium hover:text-brand-700">{i.patientName}</Link><span className="mr-1 text-xs text-slate-400 num">{i.patient.fileNumber}</span></td><td className="max-w-xs truncate text-xs">{i.chiefComplaint}</td><td className="max-w-[160px] truncate text-xs text-slate-500">{i.diagnosis ?? "-"}</td><td className="text-xs">{i.therapistName}</td><td><Link href={`/panel/forms/intake/${i.id}`} className="text-brand-600"><Eye className="h-4 w-4" /></Link></td></tr>
            ))}</tbody>
          </table>
        ) : <EmptyState title="فرمی یافت نشد" icon={<ClipboardList className="h-6 w-6" />} />}
      </Card>
    </>
  );
}

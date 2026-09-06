"use client";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/hooks";
import { Card, SearchInput, Select } from "@/components/ui";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";

export interface FormFilterState { q: string; therapistId: string; from: Date | null; to: Date | null; type?: string }

export function FormFilters({ value, onChange, extra }: { value: FormFilterState; onChange: (v: FormFilterState) => void; extra?: React.ReactNode }) {
  const { user } = useAuth();
  const { data: therapists } = useTherapists();
  return (
    <Card className="mb-5">
      <div className="grid gap-3 md:grid-cols-5">
        <SearchInput value={value.q} onChange={(q) => onChange({ ...value, q })} placeholder="نام یا شماره پرونده بیمار..." className="md:col-span-2" />
        {user?.role !== "THERAPIST" && <Select value={value.therapistId} onChange={(e) => onChange({ ...value, therapistId: e.target.value })}><option value="">همه درمانگران</option>{therapists?.items.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select>}
        <JalaliDatePicker value={value.from} onChange={(from) => onChange({ ...value, from })} placeholder="از تاریخ" />
        <JalaliDatePicker value={value.to} onChange={(to) => onChange({ ...value, to })} placeholder="تا تاریخ" />
        {extra}
      </div>
    </Card>
  );
}

export function filterParams(f: FormFilterState) {
  return { q: f.q, therapistId: f.therapistId, from: f.from?.toISOString(), to: f.to?.toISOString(), type: f.type };
}

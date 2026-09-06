"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/hooks";
import { Field, Select, Toggle } from "@/components/ui";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { PatientPicker } from "@/components/ui/PatientPicker";

export interface FormHead { patientId: string; patientLabel: string; therapistId: string; date: Date | null; visibleToPatient: boolean }

/** بخش مشترک بالای فرم‌های بالینی: بیمار، درمانگر، تاریخ، نمایش به بیمار */
export function FormHeaderFields({ value, onChange, locked }: { value: FormHead; onChange: (v: FormHead) => void; locked?: boolean }) {
  const { user } = useAuth();
  const { data: therapists } = useTherapists();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="بیمار" required className="lg:col-span-2"><PatientPicker value={value.patientId} initialLabel={value.patientLabel} disabled={locked} onChange={(id, p) => onChange({ ...value, patientId: id ?? "", patientLabel: p ? `${p.fullName} (${p.fileNumber})` : "", therapistId: value.therapistId || p?.primaryTherapistId || "" })} /></Field>
      {user?.role !== "THERAPIST" && (
        <Field label="درمانگر" required><Select value={value.therapistId} onChange={(e) => onChange({ ...value, therapistId: e.target.value })} disabled={locked}><option value="">انتخاب کنید</option>{therapists?.items.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select></Field>
      )}
      <Field label="تاریخ"><JalaliDatePicker value={value.date} onChange={(d) => onChange({ ...value, date: d })} /></Field>
      <div className="flex items-end pb-2 sm:col-span-2 lg:col-span-4"><Toggle checked={value.visibleToPatient} onChange={(c) => onChange({ ...value, visibleToPatient: c })} label="نمایش این فرم در پنل بیمار" /></div>
    </div>
  );
}

export function usePatientLabel(patientId?: string | null) {
  const { data } = useQuery({ queryKey: ["patient-label", patientId], queryFn: () => api.get<any>(`/patients/${patientId}`), enabled: !!patientId, staleTime: 60_000 });
  return data ? `${data.patient.fullName} (${data.patient.fileNumber})` : "";
}

export function useFormHead(init?: Partial<FormHead>) {
  return useState<FormHead>({ patientId: init?.patientId ?? "", patientLabel: init?.patientLabel ?? "", therapistId: init?.therapistId ?? "", date: init?.date ?? new Date(), visibleToPatient: init?.visibleToPatient ?? true });
}

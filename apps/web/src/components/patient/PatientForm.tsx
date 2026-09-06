"use client";
import { useState } from "react";
import { toast } from "sonner";
import { GENDERS, GENDER_LABELS, PATIENT_STATUSES, PATIENT_STATUS_LABELS } from "@toranj/shared";
import { api } from "@/lib/api";
import { useTherapists } from "@/lib/hooks";
import { Button, Field, Input, Select, Textarea, Toggle } from "@/components/ui";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";

export interface PatientFormValues {
  firstName: string;
  lastName: string;
  phone: string;
  birthDate: Date | null;
  gender: string;
  nationalId: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  referralSource: string;
  diagnosis: string;
  notes: string;
  status: string;
  primaryTherapistId: string;
  tags: string;
  createAccount: boolean;
}

export function toFormValues(p?: any): PatientFormValues {
  return {
    firstName: p?.firstName ?? "",
    lastName: p?.lastName ?? "",
    phone: p?.phone ?? "",
    birthDate: p?.birthDate ? new Date(p.birthDate) : null,
    gender: p?.gender ?? "",
    nationalId: p?.nationalId ?? "",
    guardianName: p?.guardianName ?? "",
    guardianPhone: p?.guardianPhone ?? "",
    address: p?.address ?? "",
    referralSource: p?.referralSource ?? "",
    diagnosis: p?.diagnosis ?? "",
    notes: p?.notes ?? "",
    status: p?.status ?? "ACTIVE",
    primaryTherapistId: p?.primaryTherapistId ?? "",
    tags: (p?.tags ?? []).join("، "),
    createAccount: true,
  };
}

export function PatientForm({ initial, patientId, leadId, onSaved, onCancel }: { initial?: any; patientId?: string; leadId?: string; onSaved: (p: any) => void; onCancel?: () => void }) {
  const [v, setV] = useState<PatientFormValues>(toFormValues(initial));
  const [loading, setLoading] = useState(false);
  const { data: therapists } = useTherapists();
  const set = (k: keyof PatientFormValues, val: any) => setV((s) => ({ ...s, [k]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = { ...v, birthDate: v.birthDate ? v.birthDate.toISOString() : null, gender: v.gender || null, primaryTherapistId: v.primaryTherapistId || null, tags: v.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean), leadId };
      const r = patientId ? await api.patch<{ patient: any }>(`/patients/${patientId}`, payload) : await api.post<{ patient: any }>("/patients", payload);
      toast.success(patientId ? "اطلاعات بیمار به‌روز شد" : `پرونده ${r.patient.fileNumber} ساخته شد`);
      onSaved(r.patient);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام" required><Input value={v.firstName} onChange={(e) => set("firstName", e.target.value)} required autoFocus /></Field>
        <Field label="نام خانوادگی" required><Input value={v.lastName} onChange={(e) => set("lastName", e.target.value)} required /></Field>
        <Field label="شماره موبایل" required hint="برای ورود بیمار به اپلیکیشن و دریافت پیامک"><Input value={v.phone} onChange={(e) => set("phone", e.target.value)} required dir="ltr" className="num text-left" placeholder="09123456789" /></Field>
        <Field label="تاریخ تولد"><JalaliDatePicker value={v.birthDate} onChange={(d) => set("birthDate", d)} /></Field>
        <Field label="جنسیت">
          <Select value={v.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="">انتخاب کنید</option>
            {GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
          </Select>
        </Field>
        <Field label="کد ملی"><Input value={v.nationalId} onChange={(e) => set("nationalId", e.target.value)} dir="ltr" className="num text-left" /></Field>
        <Field label="نام سرپرست / والد"><Input value={v.guardianName} onChange={(e) => set("guardianName", e.target.value)} /></Field>
        <Field label="شماره سرپرست"><Input value={v.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} dir="ltr" className="num text-left" /></Field>
        <Field label="درمانگر اصلی">
          <Select value={v.primaryTherapistId} onChange={(e) => set("primaryTherapistId", e.target.value)}>
            <option value="">تعیین نشده</option>
            {therapists?.items.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </Select>
        </Field>
        <Field label="نحوه آشنایی / معرف"><Input value={v.referralSource} onChange={(e) => set("referralSource", e.target.value)} placeholder="مثلاً: معرفی پزشک، اینستاگرام" /></Field>
        {patientId && (
          <Field label="وضعیت پرونده">
            <Select value={v.status} onChange={(e) => set("status", e.target.value)}>
              {PATIENT_STATUSES.map((s) => <option key={s} value={s}>{PATIENT_STATUS_LABELS[s]}</option>)}
            </Select>
          </Field>
        )}
        <Field label="برچسب‌ها" hint="با ویرگول جدا کنید؛ مثال: کودک، اتیسم"><Input value={v.tags} onChange={(e) => set("tags", e.target.value)} /></Field>
      </div>
      <Field label="تشخیص / علت مراجعه"><Input value={v.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} /></Field>
      <Field label="آدرس"><Textarea value={v.address} onChange={(e) => set("address", e.target.value)} className="min-h-[60px]" /></Field>
      <Field label="یادداشت داخلی" hint="فقط برای کارکنان نمایش داده می‌شود"><Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[60px]" /></Field>
      {!patientId && <Toggle checked={v.createAccount} onChange={(c) => set("createAccount", c)} label="ساخت حساب کاربری و ارسال پیامک خوش‌آمد" description="بیمار با همین شماره موبایل و کد پیامکی وارد اپلیکیشن می‌شود" />}
      <div className="flex justify-end gap-2 border-t border-sand-200 pt-4">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>انصراف</Button>}
        <Button type="submit" loading={loading}>{patientId ? "ذخیره تغییرات" : "ثبت پرونده"}</Button>
      </div>
    </form>
  );
}

"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/hooks";
import { Button, Field, Input, Modal, Select, Textarea, useConfirm } from "@/components/ui";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { PatientPicker } from "@/components/ui/PatientPicker";

interface Initial {
  id?: string;
  patientId?: string;
  patientLabel?: string;
  therapistId?: string;
  startAt?: Date | string;
  durationMin?: number;
  room?: string | null;
  notes?: string | null;
  price?: number | null;
  status?: string;
}

export function AppointmentModal({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: Initial; onSaved: () => void }) {
  const { user } = useAuth();
  const { data: therapists } = useTherapists();
  const { confirm, dialog } = useConfirm();
  const [v, setV] = useState({ patientId: "", patientLabel: "", therapistId: "", startAt: new Date() as Date | null, durationMin: 45, room: "", notes: "", price: "", status: "SCHEDULED" });
  const [loading, setLoading] = useState(false);
  const isEdit = !!initial?.id;
  const canDelete = user?.role === "ADMIN" || user?.role === "SECRETARY";

  useEffect(() => {
    if (!open) return;
    const start = initial?.startAt ? new Date(initial.startAt) : new Date();
    if (!initial?.startAt) { start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1); }
    setV({
      patientId: initial?.patientId ?? "",
      patientLabel: initial?.patientLabel ?? "",
      therapistId: initial?.therapistId || (user?.role === "THERAPIST" ? user.therapistId ?? "" : ""),
      startAt: start,
      durationMin: initial?.durationMin ?? 45,
      room: initial?.room ?? "",
      notes: initial?.notes ?? "",
      price: initial?.price != null ? String(initial.price) : "",
      status: initial?.status ?? "SCHEDULED",
    });
  }, [open, initial, user]);

  const save = async () => {
    if (!v.patientId) return toast.error("بیمار را انتخاب کنید");
    if (!v.therapistId) return toast.error("درمانگر را انتخاب کنید");
    if (!v.startAt) return toast.error("زمان را مشخص کنید");
    setLoading(true);
    try {
      const payload = { patientId: v.patientId, therapistId: v.therapistId, startAt: v.startAt.toISOString(), durationMin: Number(v.durationMin), room: v.room || null, notes: v.notes || null, price: v.price ? Number(v.price) : null, status: v.status };
      if (isEdit) await api.patch(`/appointments/${initial!.id}`, payload); else await api.post("/appointments", payload);
      toast.success(isEdit ? "نوبت به‌روز شد" : "نوبت ثبت شد");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const remove = async () => {
    if (!(await confirm("این نوبت حذف شود؟"))) return;
    try { await api.delete(`/appointments/${initial!.id}`); toast.success("حذف شد"); onSaved(); } catch (e: any) { toast.error(e.message); }
  };
  const therapist = therapists?.items.find((t) => t.id === v.therapistId);
  const timeStr = v.startAt ? `${String(v.startAt.getHours()).padStart(2, "0")}:${String(v.startAt.getMinutes()).padStart(2, "0")}` : "";

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "ویرایش نوبت" : "نوبت جدید"} footer={<>{isEdit && canDelete && <Button variant="ghost" onClick={remove} icon={<Trash2 className="h-4 w-4" />} className="ml-auto text-coral-600">حذف</Button>}<Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={save}>{isEdit ? "ذخیره" : "ثبت نوبت"}</Button></>}>
      {dialog}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="بیمار" required className="sm:col-span-2"><PatientPicker value={v.patientId} initialLabel={v.patientLabel} onChange={(id, p) => setV({ ...v, patientId: id ?? "", patientLabel: p ? `${p.fullName} (${p.fileNumber})` : "", therapistId: v.therapistId || p?.primaryTherapistId || "" })} /></Field>
        <Field label="درمانگر" required>
          <Select value={v.therapistId} onChange={(e) => setV({ ...v, therapistId: e.target.value })} disabled={user?.role === "THERAPIST"}>
            <option value="">انتخاب کنید</option>
            {therapists?.items.filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </Select>
        </Field>
        <Field label="تاریخ" required><JalaliDatePicker value={v.startAt} onChange={(d) => setV({ ...v, startAt: d })} /></Field>
        <Field label="ساعت شروع" required><Input type="time" value={timeStr} onChange={(e) => { const [h, m] = e.target.value.split(":").map(Number); const d = new Date(v.startAt ?? new Date()); d.setHours(h || 0, m || 0, 0, 0); setV({ ...v, startAt: d }); }} className="num" dir="ltr" step={300} /></Field>
        <Field label="مدت (دقیقه)"><Select value={v.durationMin} onChange={(e) => setV({ ...v, durationMin: Number(e.target.value) })}>{[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} دقیقه</option>)}</Select></Field>
        <Field label="اتاق"><Input value={v.room} onChange={(e) => setV({ ...v, room: e.target.value })} placeholder="مثلاً: اتاق ۲" /></Field>
        <Field label="قیمت جلسه (تومان)" hint={therapist?.sessionPrice ? `پیش‌فرض درمانگر: ${therapist.sessionPrice.toLocaleString()}` : undefined}><Input value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} className="num" dir="ltr" placeholder="پیش‌فرض" /></Field>
        {isEdit && <Field label="وضعیت"><Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>{APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>)}</Select></Field>}
        <Field label="یادداشت" className="sm:col-span-2"><Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} className="min-h-[60px]" /></Field>
      </div>
    </Modal>
  );
}

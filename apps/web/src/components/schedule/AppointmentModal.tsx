"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Banknote } from "lucide-react";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS, formatMoney, WEEKDAYS_FA, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/hooks";
import { Button, Field, Input, Modal, Select, Textarea, Toggle, useConfirm } from "@/components/ui";
import { cn } from "@/lib/utils";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { MoneyInput } from "@/components/ui/MoneyInput";

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

export function AppointmentModal({ open, onClose, initial, onSaved, onSettle }: { open: boolean; onClose: () => void; initial?: Initial; onSaved: () => void; onSettle?: () => void }) {
  const { user } = useAuth();
  const { data: therapists } = useTherapists();
  const { confirm, dialog } = useConfirm();
  const [v, setV] = useState({ patientId: "", patientLabel: "", therapistId: "", startAt: new Date() as Date | null, durationMin: 45, room: "", notes: "", price: "", status: "SCHEDULED" });
  const [loading, setLoading] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [weeks, setWeeks] = useState(8);
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
    if (!v.patientId) return toast.error("مراجع را انتخاب کنید");
    if (!v.therapistId) return toast.error("درمانگر را انتخاب کنید");
    if (!v.startAt) return toast.error("زمان را مشخص کنید");
    setLoading(true);
    try {
      const payload = { patientId: v.patientId, therapistId: v.therapistId, startAt: v.startAt.toISOString(), durationMin: Number(v.durationMin), room: v.room || null, notes: v.notes || null, price: v.price ? Number(v.price) : null, status: v.status };
      if (!isEdit && repeat) {
        if (!weekdays.length) { setLoading(false); return toast.error("حداقل یک روز هفته را انتخاب کنید"); }
        const r = await api.post<{ created: number; skipped: number; skippedDates: string[] }>("/appointments/recurring", { ...payload, weekdays, weeks, status: undefined });
        toast.success(`${toPersianDigits(r.created)} نوبت ساخته شد${r.skipped ? `؛ ${toPersianDigits(r.skipped)} مورد به‌دلیل تداخل رد شد` : ""}`, { duration: 6000 });
        if (r.skippedDates.length) toast.message("زمان‌های رد‌شده: " + r.skippedDates.slice(0, 4).join("، ") + (r.skippedDates.length > 4 ? " …" : ""), { duration: 9000 });
      } else if (isEdit) await api.patch(`/appointments/${initial!.id}`, payload); else await api.post("/appointments", payload);
      if (isEdit || !repeat) toast.success(isEdit ? "نوبت به‌روز شد" : "نوبت ثبت شد");
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
    <Modal open={open} onClose={onClose} title={isEdit ? "ویرایش نوبت" : "نوبت جدید"} footer={<>{isEdit && canDelete && <Button variant="ghost" onClick={remove} icon={<Trash2 className="h-4 w-4" />} className="text-coral-600">حذف</Button>}{isEdit && canDelete && onSettle && v.status !== "CANCELLED" && <Button variant="accent" onClick={onSettle} icon={<Banknote className="h-4 w-4" />} className="ml-auto">تسویه</Button>}<Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={save}>{isEdit ? "ذخیره" : repeat ? "ساخت نوبت‌های تکراری" : "ثبت نوبت"}</Button></>}>
      {dialog}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="مراجع" required className="sm:col-span-2"><PatientPicker value={v.patientId} initialLabel={v.patientLabel} onChange={(id, p) => setV({ ...v, patientId: id ?? "", patientLabel: p ? `${p.fullName} (${p.fileNumber})` : "", therapistId: v.therapistId || p?.primaryTherapistId || "" })} /></Field>
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
        <Field label="قیمت جلسه (تومان)" hint={therapist?.sessionPrice ? `پیش‌فرض درمانگر: ${formatMoney(therapist.sessionPrice)}` : undefined}><MoneyInput value={v.price} onChange={(d) => setV({ ...v, price: d })} placeholder="پیش‌فرض" suffix="تومان" /></Field>
        {isEdit && <Field label="وضعیت"><Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>{APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>)}</Select></Field>}
        <Field label="یادداشت" className="sm:col-span-2"><Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} className="min-h-[60px]" /></Field>
        {!isEdit && canDelete && (
          <div className="rounded-2xl bg-sand-100 p-3 sm:col-span-2">
            <Toggle checked={repeat} onChange={(c) => { setRepeat(c); if (c && v.startAt && !weekdays.length) setWeekdays([v.startAt.getDay()]); }} label="تکرار هفتگی (برنامه ثابت)" description="همین ساعت در روزهای انتخابی، برای چند هفته ساخته می‌شود؛ زمان‌های دارای تداخل رد می‌شوند" />
            {repeat && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {[6, 0, 1, 2, 3, 4, 5].map((d) => <button key={d} type="button" onClick={() => setWeekdays(weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d])} className={cn("rounded-xl px-3 py-1.5 text-xs font-medium transition", weekdays.includes(d) ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-brand-50")}>{WEEKDAYS_FA[d]}</button>)}
                <span className="mr-auto flex items-center gap-2 text-xs text-slate-600">برای<Select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="w-24">{[2, 4, 6, 8, 10, 12, 16, 20, 26].map((n) => <option key={n} value={n}>{toPersianDigits(n)} هفته</option>)}</Select></span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

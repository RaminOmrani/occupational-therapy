"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Hourglass, Plus, CalendarPlus, Trash2, Phone, CheckCheck } from "lucide-react";
import { WEEKDAYS_FA, formatJalali, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/hooks";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, useConfirm } from "@/components/ui";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { AppointmentModal } from "@/components/schedule/AppointmentModal";
import { cn } from "@/lib/utils";

export default function WaitlistPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const { data: therapists } = useTherapists();
  const [status, setStatus] = useState<"ACTIVE" | "FULFILLED" | "ALL">("ACTIVE");
  const [therapistId, setTherapistId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [book, setBook] = useState<any | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["waitlist", status, therapistId], queryFn: () => api.get<{ items: any[] }>("/waitlist", { status, therapistId }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["waitlist"] });
  const canManage = user?.role === "ADMIN" || user?.role === "SECRETARY";
  const setEntryStatus = async (e: any, s: string) => { try { await api.patch(`/waitlist/${e.id}`, { status: s }); refresh(); } catch (err: any) { toast.error(err.message); } };
  const remove = async (e: any) => { if (!(await confirm("از لیست انتظار حذف شود؟"))) return; await api.delete(`/waitlist/${e.id}`); refresh(); };
  return (
    <>
      {dialog}
      <PageHeader title="لیست انتظار" subtitle="مراجعینی که منتظر خالی‌شدن نوبت هستند؛ با لغو هر نوبت، به شما و نفر اول لیست اطلاع داده می‌شود" icon={<Hourglass className="h-5 w-5" />} actions={<Button onClick={() => setAddOpen(true)} icon={<Plus className="h-4 w-4" />}>افزودن به لیست</Button>} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={status} onChange={setStatus} tabs={[{ key: "ACTIVE", label: "در انتظار" }, { key: "FULFILLED", label: "نوبت گرفته" }, { key: "ALL", label: "همه" }]} />
          <Select value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className="w-48"><option value="">همه درمانگران</option>{therapists?.items.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select>
        </div>
      </Card>
      <Card padded={false} className="overflow-x-auto">
        {isLoading ? <Spinner /> : data?.items.length ? (
          <table className="table">
            <thead><tr><th>#</th><th>مراجع</th><th>درمانگر</th><th>روزهای مناسب</th><th>زمان</th><th>یادداشت</th><th>ثبت</th><th>وضعیت</th><th /></tr></thead>
            <tbody>
              {data.items.map((e, i) => (
                <tr key={e.id}>
                  <td className="num text-xs text-slate-400">{toPersianDigits(i + 1)}</td>
                  <td><Link href={`/panel/patients/${e.patientId}`} className="font-medium hover:text-brand-700">{e.patientName}</Link><a href={`tel:${e.patient.phone}`} className="num mr-2 text-xs text-slate-400" dir="ltr"><Phone className="inline h-3 w-3" /> {toPersianDigits(e.patient.phone)}</a></td>
                  <td className="text-xs">{e.therapistName ?? <span className="text-slate-400">هر درمانگری</span>}</td>
                  <td className="text-xs">{e.preferredDays.length ? e.preferredDays.map((d: number) => WEEKDAYS_FA[d]).join("، ") : <span className="text-slate-400">هر روز</span>}</td>
                  <td className="text-xs">{e.preferredTime ?? "-"}</td>
                  <td className="max-w-[200px] truncate text-xs text-slate-500">{e.note ?? "-"}</td>
                  <td className="num text-xs text-slate-400">{formatJalali(e.createdAt)}{e.notifiedAt && <span className="block text-[10px] text-brand-600">پیامک خالی‌شدن نوبت ارسال شد</span>}</td>
                  <td><Badge tone={e.status === "ACTIVE" ? "amber" : e.status === "FULFILLED" ? "sage" : "slate"}>{e.status === "ACTIVE" ? "در انتظار" : e.status === "FULFILLED" ? "نوبت گرفت" : "لغو"}</Badge></td>
                  <td className="flex gap-1">
                    {e.status === "ACTIVE" && <button onClick={() => setBook(e)} className="flex items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 text-xs font-bold text-white hover:bg-brand-700"><CalendarPlus className="h-3.5 w-3.5" />ثبت نوبت</button>}
                    {e.status === "ACTIVE" && canManage && <button onClick={() => setEntryStatus(e, "FULFILLED")} title="نوبت گرفته" className="rounded-lg bg-sage-100 px-2 py-1 text-xs text-sage-700"><CheckCheck className="h-3.5 w-3.5" /></button>}
                    {canManage && <button onClick={() => remove(e)} className="rounded-lg px-2 py-1 text-slate-400 hover:text-coral-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لیست انتظار خالی است" description="از صفحه مراجع یا دکمه بالا اضافه کنید" />}
      </Card>
      {addOpen && <AddModal onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); refresh(); }} />}
      {book && <AppointmentModal open onClose={() => setBook(null)} initial={{ patientId: book.patientId, patientLabel: `${book.patientName} (${book.patient.fileNumber})`, therapistId: book.therapistId ?? undefined }} onSaved={async () => { await api.patch(`/waitlist/${book.id}`, { status: "FULFILLED" }).catch(() => null); setBook(null); refresh(); }} />}
    </>
  );
}

function AddModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: therapists } = useTherapists();
  const [v, setV] = useState({ patientId: "", therapistId: "", preferredDays: [] as number[], preferredTime: "", note: "" });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!v.patientId) return toast.error("مراجع را انتخاب کنید");
    setLoading(true);
    try { const r = await api.post<{ duplicate?: boolean }>("/waitlist", { ...v, therapistId: v.therapistId || undefined }); toast[r.duplicate ? "message" : "success"](r.duplicate ? "این مراجع از قبل در لیست است" : "اضافه شد"); onDone(); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="افزودن به لیست انتظار" size="sm" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={save}>افزودن</Button></>}>
      <div className="space-y-3">
        <Field label="مراجع" required><PatientPicker value={v.patientId} onChange={(id, p) => setV({ ...v, patientId: id ?? "", therapistId: v.therapistId || p?.primaryTherapistId || "" })} /></Field>
        <Field label="درمانگر" hint="خالی = هر درمانگری"><Select value={v.therapistId} onChange={(e) => setV({ ...v, therapistId: e.target.value })}><option value="">هر درمانگری</option>{therapists?.items.filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select></Field>
        <Field label="روزهای مناسب" hint="خالی = هر روز"><div className="flex flex-wrap gap-1.5">{[6, 0, 1, 2, 3, 4, 5].map((d) => <button key={d} type="button" onClick={() => setV({ ...v, preferredDays: v.preferredDays.includes(d) ? v.preferredDays.filter((x) => x !== d) : [...v.preferredDays, d] })} className={cn("rounded-xl px-3 py-1.5 text-xs font-medium", v.preferredDays.includes(d) ? "bg-brand-600 text-white" : "bg-sand-200 text-slate-600")}>{WEEKDAYS_FA[d]}</button>)}</div></Field>
        <Field label="زمان مناسب"><Input value={v.preferredTime} onChange={(e) => setV({ ...v, preferredTime: e.target.value })} placeholder="مثلاً صبح‌ها، بعد از ۱۶" /></Field>
        <Field label="یادداشت"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

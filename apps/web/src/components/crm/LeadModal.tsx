"use client";
import { useState } from "react";
import { toast } from "sonner";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_SOURCES, LEAD_SOURCE_LABELS } from "@toranj/shared";
import { api } from "@/lib/api";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";

export function LeadModal({ lead, onClose, onDone }: { lead?: any; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ firstName: lead?.firstName === "ناشناس" ? "" : lead?.firstName ?? "", lastName: lead?.lastName ?? "", phone: lead?.phone ?? "", source: lead?.source ?? "PHONE", status: lead?.status ?? "NEW", interest: lead?.interest ?? "", notes: lead?.notes ?? "", followUpAt: lead?.followUpAt ? new Date(lead.followUpAt) : (null as Date | null) });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    try {
      const payload = { ...v, firstName: v.firstName || "ناشناس", followUpAt: v.followUpAt?.toISOString() ?? null };
      if (lead) await api.patch(`/leads/${lead.id}`, payload); else await api.post("/leads", payload);
      toast.success("ذخیره شد"); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title={lead ? "ویرایش لید" : "لید جدید"} footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={save}>ذخیره</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام"><Input value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} autoFocus /></Field>
        <Field label="نام خانوادگی"><Input value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} /></Field>
        <Field label="موبایل" required><Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} dir="ltr" className="num text-left" /></Field>
        <Field label="منبع"><Select value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })}>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>)}</Select></Field>
        <Field label="وضعیت"><Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}</Select></Field>
        <Field label="پیگیری بعدی"><JalaliDatePicker value={v.followUpAt} onChange={(d) => setV({ ...v, followUpAt: d })} /></Field>
        <Field label="علاقه‌مندی / نیاز" className="sm:col-span-2"><Input value={v.interest} onChange={(e) => setV({ ...v, interest: e.target.value })} placeholder="مثلاً: کاردرمانی کودک ۴ ساله" /></Field>
        <Field label="یادداشت" className="sm:col-span-2"><Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} className="min-h-[60px]" /></Field>
      </div>
    </Modal>
  );
}


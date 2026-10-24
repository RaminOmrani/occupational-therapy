"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { formatJalaliLong, formatMoney, formatTime } from "@toranj/shared";
import { api } from "@/lib/api";
import { Button, Field, Input, Modal, Spinner, Toggle } from "@/components/ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { cn } from "@/lib/utils";
import { HelpLink } from "@/components/help/HelpLink";

export const SETTLE_METHODS = [
  { key: "TRANSFER", emoji: "💳", label: "کارت به کارت" },
  { key: "CASH", emoji: "💵", label: "نقدی" },
  { key: "CARD", emoji: "🏧", label: "پرداخت پایانه (کارت‌خوان)" },
] as const;

interface Preview {
  appointment: { id: string; startAt: string; status: string; patientId: string; patientName: string; fileNumber: string; therapistName: string };
  sessionPrice: number;
  listPrice: number;
  therapistAmount: number;
  kind: string;
  alreadyInvoiced: boolean;
  previousBalance: number;
  walletBalance: number;
  totalDue: number;
}

/** تسویه یک نوبت: انتخاب روش پرداخت و مبلغ (کامل، دلخواه، یا پرداخت‌نشده که به بدهی مراجع اضافه می‌شود) */
export function SettleModal({ appointmentId, onClose, onDone }: { appointmentId: string; onClose: () => void; onDone?: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settle-preview", appointmentId], queryFn: () => api.get<Preview>(`/finance/settle-preview/${appointmentId}`) });
  const [method, setMethod] = useState<(typeof SETTLE_METHODS)[number]["key"]>("TRANSFER");
  const [mode, setMode] = useState<"full" | "custom" | "none">("full");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [sendSms, setSendSms] = useState(false);
  const [therapistAmount, setTherapistAmount] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (data) { setAmount(String(data.totalDue || data.sessionPrice || "")); setTherapistAmount(String(data.therapistAmount ?? data.sessionPrice ?? "")); } }, [data]);
  // مبلغ واقعی جلسه (= کارکرد درمانگر) همان مبلغی است که از حساب مراجع کسر می‌شود
  const actual = therapistAmount === "" ? (data?.sessionPrice ?? 0) : Number(therapistAmount);
  const totalDue = data ? Math.max(0, data.previousBalance + actual) : 0;

  const submit = async () => {
    if (!data) return;
    const custom = Number(amount || 0);
    if (mode === "custom" && custom <= 0) return toast.error("مبلغ را وارد کنید");

    setLoading(true);
    try {
      const r = await api.post<{ paid: number; summary: { balance: number } }>("/finance/settle-appointment", { appointmentId, method, full: mode === "full", noPayment: mode === "none", amount: mode === "custom" ? custom : undefined, reference: reference || undefined, sendSms, therapistAmount: actual });
      toast.success(r.paid > 0 ? `${formatMoney(r.paid)} ثبت شد${r.summary.balance > 0 ? `؛ مانده بدهی ${formatMoney(r.summary.balance)}` : r.summary.balance < 0 ? `؛ بستانکار ${formatMoney(-r.summary.balance)}` : "؛ تسویه کامل ✅"}` : mode === "none" ? `جلسه ثبت شد؛ مانده بدهی مراجع: ${formatMoney(Math.max(0, r.summary.balance))}` : "جلسه انجام‌شده ثبت شد");
      qc.invalidateQueries({ queryKey: ["appointments"] }); qc.invalidateQueries({ queryKey: ["finance"] }); qc.invalidateQueries({ queryKey: ["daily"] }); qc.invalidateQueries({ queryKey: ["dashboard"] });
      onDone?.();
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2">تسویه جلسه <HelpLink anchor="settle" /></span>} size="sm" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} disabled={!data} onClick={submit} icon={<CheckCircle2 className="h-4 w-4" />}>{mode === "full" ? `تسویه کامل${data ? ` (${formatMoney(totalDue)})` : ""}` : mode === "none" ? "ثبت جلسه به‌صورت بدهی" : "ثبت پرداخت"}</Button></>}>
      {isLoading || !data ? <Spinner /> : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-sand-100 p-3 text-sm">
            <p className="font-bold">{data.appointment.patientName} <span className="num text-xs font-normal text-slate-400">{data.appointment.fileNumber}</span>{data.kind === "ASSESSMENT" && <span className="mr-2 rounded bg-violet-100 px-1.5 text-[10px] font-bold text-violet-700">جلسه ارزیابی</span>}</p>
            <p className="mt-0.5 text-xs text-slate-500">{formatJalaliLong(data.appointment.startAt, true)} ساعت {formatTime(data.appointment.startAt)} · {data.appointment.therapistName}</p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white p-2"><dt className="text-slate-400">این جلسه</dt><dd className="num mt-0.5 font-bold text-slate-800">{formatMoney(actual)}</dd></div>
              <div className="rounded-xl bg-white p-2"><dt className="text-slate-400">{data.previousBalance >= 0 ? "بدهی قبلی" : "بستانکاری قبلی"}</dt><dd className={cn("num mt-0.5 font-bold", data.previousBalance > 0 ? "text-coral-600" : "text-sage-700")}>{formatMoney(Math.abs(data.previousBalance))}</dd></div>
              <div className="rounded-xl bg-brand-600 p-2 text-white"><dt className="text-brand-100">جمع قابل پرداخت</dt><dd className="num mt-0.5 font-bold">{formatMoney(totalDue)}</dd></div>
            </dl>
            {data.previousBalance < 0 && <p className="mt-2 text-[11px] text-sage-700">مراجع {formatMoney(-data.previousBalance)} بستانکار (پیش‌پرداخت) دارد که اول صرف این جلسه می‌شود.</p>}
            {data.walletBalance > 0 && <p className="mt-2 text-[11px] text-slate-500">کیف پول مراجع: {formatMoney(data.walletBalance)} (برای استفاده از کیف پول، از پروفایل مالی مراجع اقدام کنید)</p>}
          </div>

          <Field label="مبلغ واقعی این جلسه (= کارکرد درمانگر)" hint={`${data.listPrice !== actual ? `مبلغ پرونده ${formatMoney(data.listPrice)} است. ` : ""}اگر جلسه کوتاه‌تر شد (مثلاً درمانگر دیر آمد)، مبلغ واقعی را بنویسید؛ همین عدد کارکرد درمانگر است و همین از حساب مراجع کسر می‌شود. اگر مراجع بیشتر پرداخت کرده باشد، مازاد بستانکاری او می‌شود.`}><MoneyInput value={therapistAmount} onChange={setTherapistAmount} suffix="تومان" /></Field>
          {mode !== "none" && <Field label="روش پرداخت" required>
            <div className="grid grid-cols-3 gap-2">
              {SETTLE_METHODS.map((m) => (
                <button key={m.key} type="button" onClick={() => setMethod(m.key)} className={cn("flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-xs font-medium transition", method === m.key ? "border-brand-600 bg-brand-50 text-brand-800" : "border-sand-200 bg-white text-slate-600 hover:border-brand-300")}>
                  <span className="text-2xl leading-none">{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </Field>}

          <Field label="مبلغ پرداختی مراجع" required>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setMode("full")} className={cn("rounded-2xl border-2 p-3 text-sm font-bold transition", mode === "full" ? "border-brand-600 bg-brand-50 text-brand-800" : "border-sand-200 bg-white text-slate-600 hover:border-brand-300")}>تسویه کامل<span className="num mt-1 block text-xs font-normal text-slate-500">{formatMoney(totalDue)}</span></button>
              <button type="button" onClick={() => setMode("custom")} className={cn("rounded-2xl border-2 p-3 text-sm font-bold transition", mode === "custom" ? "border-brand-600 bg-brand-50 text-brand-800" : "border-sand-200 bg-white text-slate-600 hover:border-brand-300")}>مبلغ دلخواه<span className="mt-1 block text-xs font-normal text-slate-500">نصف یا هر مبلغ</span></button>
              <button type="button" onClick={() => setMode("none")} className={cn("rounded-2xl border-2 p-3 text-sm font-bold transition", mode === "none" ? "border-coral-500 bg-coral-500/10 text-coral-700" : "border-sand-200 bg-white text-slate-600 hover:border-coral-400")}>پرداخت نکرد<span className="mt-1 block text-xs font-normal text-slate-500">همه بدهی شود</span></button>
            </div>
            {mode === "custom" && <div className="mt-2"><MoneyInput value={amount} onChange={setAmount} suffix="تومان" autoFocus /></div>}
            {mode !== "full" && (() => { const after = data.previousBalance + actual - (mode === "custom" ? Number(amount || 0) : 0); return <p className={cn("mt-2 rounded-xl px-3 py-2 text-xs", after > 0 ? "bg-coral-500/10 text-coral-700" : "bg-sage-100 text-sage-700")}>{after > 0 ? <>مانده بدهی مراجع پس از ثبت: <b className="num">{formatMoney(after)}</b> (در پروفایل مالی او به‌عنوان بدهی ثبت می‌شود)</> : after < 0 ? <>مازاد <b className="num">{formatMoney(-after)}</b> به‌عنوان پیش‌پرداخت (بستانکاری) ثبت می‌شود</> : "حساب مراجع کامل تسویه می‌شود ✅"}</p>; })()}
          </Field>
          {mode !== "none" && method !== "CASH" && <Field label="شماره پیگیری / ۴ رقم آخر کارت" hint="اختیاری"><Input value={reference} onChange={(e) => setReference(e.target.value)} className="num" dir="ltr" /></Field>}
          {mode !== "none" && <Toggle checked={sendSms} onChange={setSendSms} label="پیامک رسید پرداخت برای مراجع ارسال شود" />}
        </div>
      )}
    </Modal>
  );
}

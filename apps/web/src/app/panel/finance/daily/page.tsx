"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Printer, CalendarCheck2, Wallet, AlertTriangle, ReceiptText, Pencil, Trash2, Plus, HandCoins, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { PAYMENT_METHOD_LABELS, addDays, formatJalali, formatJalaliLong, formatMoney, formatTime, startOfDay, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePublicSettings } from "@/lib/settings";
import { useTherapists } from "@/lib/hooks";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Textarea, useConfirm } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { SettleModal, SETTLE_METHODS } from "@/components/schedule/SettleModal";
import { AppointmentModal } from "@/components/schedule/AppointmentModal";
import { cn } from "@/lib/utils";

const METHOD_EMOJI: Record<string, string> = { TRANSFER: "💳", CASH: "💵", CARD: "🏧", WALLET: "👛", ONLINE: "🌐" };
const methodLabel = (m: string) => (m === "CARD" ? "پرداخت پایانه (کارت‌خوان)" : PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS] ?? m);

function Inner() {
  const sp = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const settings = usePublicSettings();
  const { confirm, dialog } = useConfirm();
  const [date, setDate] = useState(() => (sp.get("date") ? startOfDay(new Date(sp.get("date")!)) : startOfDay(new Date())));
  const [settle, setSettle] = useState<string | null>(null);
  const [editPay, setEditPay] = useState<any | null>(null);
  const [editAppt, setEditAppt] = useState<any | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["daily", date.toISOString()], queryFn: () => api.get<any>("/finance/daily", { date: date.toISOString() }) });
  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ["appointments"] }); };
  const t = data?.totals;
  const methods = ["TRANSFER", "CASH", "CARD", "WALLET", "ONLINE"].filter((m) => m === "TRANSFER" || m === "CASH" || m === "CARD" || (t?.byMethod?.[m] ?? 0) !== 0);
  const isAdmin = user?.role === "ADMIN";
  const removePayment = async (p: any) => { if (!(await confirm(`پرداخت ${formatMoney(p.amount)} حذف شود؟`))) return; try { await api.delete(`/finance/payments/${p.id}`); toast.success("حذف شد"); refresh(); } catch (e: any) { toast.error(e.message); } };
  const removeCash = async (c: any) => { if (!(await confirm("این تراکنش حذف شود؟"))) return; try { await api.delete(`/finance/cash/${c.id}`); refresh(); } catch (e: any) { toast.error(e.message); } };
  const saveTherapistAmount = async (s: any, value: string) => { const n = Number(value || 0); if (n === s.therapistAmount) return; try { await api.patch(`/appointments/${s.id}`, { therapistAmount: n }); toast.success("کارکرد به‌روز شد"); refresh(); } catch (e: any) { toast.error(e.message); } };

  return (
    <>
      {dialog}
      <PageHeader title="صورت مالی روزانه (پایان کار)" subtitle="دریافتی‌های روز، تسویه هر درمانگر و وضعیت جلسات؛ همه‌چیز از همین‌جا قابل ویرایش است" icon={<ReceiptText className="h-5 w-5" />} actions={<>
        <Link href={`/panel/schedule?date=${date.toISOString()}`} className="btn-secondary"><CalendarCheck2 className="h-4 w-4" />برنامه این روز</Link>
        <Button variant="secondary" onClick={() => setCashOpen(true)} icon={<Plus className="h-4 w-4" />}>تراکنش دیگر</Button>
        <Button variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ</Button>
      </>} />

      <Card className="mb-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setDate(addDays(date, -1))} className="rounded-xl p-2 hover:bg-sand-200"><ChevronRight className="h-5 w-5" /></button>
            <button onClick={() => setDate(startOfDay(new Date()))} className="rounded-xl px-3 py-1.5 text-sm hover:bg-sand-200">امروز</button>
            <button onClick={() => setDate(addDays(date, 1))} className="rounded-xl p-2 hover:bg-sand-200"><ChevronLeft className="h-5 w-5" /></button>
          </div>
          <JalaliDatePicker value={date} onChange={(d) => d && setDate(startOfDay(d))} className="w-40" />
          <span className="text-sm font-bold text-brand-800">{formatJalaliLong(date, true)}</span>
        </div>
      </Card>

      {isLoading || !data ? <Spinner /> : (
        <div className="print-sheet space-y-4">
          <div className="hidden print:block"><h1 className="text-lg font-black">{settings.str("clinic.name")} — صورت مالی روز {formatJalaliLong(date, true)}</h1></div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="جمع خالص صندوق امروز" value={formatMoney(t.received)} icon={<Wallet className="h-5 w-5" />} tone="brand" hint={`پرداخت مراجعین ${formatMoney(t.patientPayments)}${t.cashIn ? ` + دیگر ${formatMoney(t.cashIn)}` : ""}${t.cashOut ? ` − خروجی ${formatMoney(t.cashOut)}` : ""}`} />
            {methods.map((m) => (
              <div key={m} className="card flex items-center gap-4 p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sand-100 text-2xl">{METHOD_EMOJI[m]}</span>
                <div className="min-w-0"><p className="text-xs text-slate-500">{methodLabel(m)}</p><p className={cn("num mt-0.5 truncate text-lg font-black", (t.byMethod?.[m] ?? 0) < 0 ? "text-coral-600" : "text-slate-800")}>{formatMoney(t.byMethod?.[m] ?? 0)}</p></div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="جلسات انجام‌شده" value={`${toPersianDigits(t.done)} از ${toPersianDigits(t.sessions)}`} tone="sage" hint={`غیبت ${toPersianDigits(t.noShow)} · لغو ${toPersianDigits(t.cancelled)}${t.pending ? ` · در انتظار ${toPersianDigits(t.pending)}` : ""}`} />
            <Stat label="جمع کارکرد درمانگران" value={formatMoney(t.karkard)} tone="violet" icon={<HandCoins className="h-5 w-5" />} hint="بر اساس کارکرد هر جلسه" />
            <Stat label="جلسات تسویه‌نشده" value={toPersianDigits(t.unsettledSessions)} tone={t.unsettledSessions ? "coral" : "sage"} icon={<AlertTriangle className="h-5 w-5" />} hint={t.unsettledSessions ? "در جدول جلسات تسویه کنید" : "همه تسویه شده ✅"} />
            <Stat label="صورت‌حساب‌های امروز" value={formatMoney(t.invoiced)} tone="slate" hint={t.discount ? `تخفیف ${formatMoney(t.discount)}` : undefined} />
          </div>

          {/* تسویه روزانه درمانگران */}
          <Card title="تسویه روزانه درمانگران" subtitle="تعداد مراجع، جلسات، کارکرد و مبلغ وصول‌شده هر درمانگر در این روز" padded={false} actions={<Link href="/panel/finance/therapists" className="text-xs text-brand-600 hover:underline">گزارش دوره‌ای</Link>}>
            {data.byTherapist.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>درمانگر</th><th>مراجعین</th><th>جلسات</th><th>ارزیابی</th><th>غیبت</th><th>کارکرد</th><th>وصول‌شده</th><th>معوق</th></tr></thead>
                  <tbody>
                    {data.byTherapist.map((r: any) => (
                      <tr key={r.therapistId}>
                        <td className="font-medium"><Link href={`/panel/finance/therapists?id=${r.therapistId}`} className="hover:text-brand-700">{r.therapistName}</Link></td>
                        <td className="num">{toPersianDigits(r.cases)}</td><td className="num">{toPersianDigits(r.sessions)}</td><td className="num">{toPersianDigits(r.assessments)}</td><td className="num">{toPersianDigits(r.noShow)}</td>
                        <td className="num font-bold">{formatMoney(r.karkard)}</td><td className="num text-sage-700">{formatMoney(r.collected)}</td><td className={cn("num", r.pending > 0 ? "text-coral-600" : "text-slate-400")}>{formatMoney(r.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-sand-50 font-bold"><td>جمع</td><td className="num">{toPersianDigits(new Set(data.sessions.filter((s: any) => s.status === "DONE").map((s: any) => s.patientId)).size)}</td><td className="num">{toPersianDigits(t.done)}</td><td colSpan={2} /><td className="num">{formatMoney(t.karkard)}</td><td className="num text-sage-700">{formatMoney(data.byTherapist.reduce((s: number, r: any) => s + r.collected, 0))}</td><td className="num">{formatMoney(data.byTherapist.reduce((s: number, r: any) => s + r.pending, 0))}</td></tr></tfoot>
                </table>
              </div>
            ) : <EmptyState title="جلسه‌ای برای این روز نیست" />}
          </Card>

          {/* پرداخت‌های روز */}
          <Card title="پرداخت‌های مراجعین" subtitle={`${toPersianDigits(data.payments.length)} مورد · برای اصلاح روش یا مبلغ روی مداد بزنید`} padded={false}>
            {data.payments.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>ساعت</th><th>مراجع</th><th>روش</th><th>مبلغ</th><th>صورت‌حساب</th><th>پیگیری / توضیح</th><th>ثبت‌کننده</th><th className="print:hidden" /></tr></thead>
                  <tbody>
                    {data.payments.map((p: any) => (
                      <tr key={p.id}>
                        <td className="num text-xs">{formatTime(p.date)}</td>
                        <td><Link href={`/panel/patients/${p.patientId}?tab=finance`} className="font-medium hover:text-brand-700">{p.patientName}</Link><span className="num mr-2 text-xs text-slate-400">{p.patient?.fileNumber}</span></td>
                        <td className="text-xs">{METHOD_EMOJI[p.method]} {methodLabel(p.method)}</td>
                        <td className="num font-bold text-sage-700">{formatMoney(p.amount)}</td>
                        <td className="num text-xs text-slate-500">{p.invoiceNumber ?? "-"}</td>
                        <td className="max-w-[220px] truncate text-xs text-slate-500" dir="auto">{[p.reference ? toPersianDigits(p.reference) : null, p.note].filter(Boolean).join(" · ") || "-"}</td>
                        <td className="text-xs text-slate-500">{p.receivedByName ?? "-"}</td>
                        <td className="print:hidden"><div className="flex gap-1">{p.method !== "WALLET" && <button onClick={() => setEditPay(p)} title="ویرایش تسویه" className="rounded-lg p-1.5 text-slate-400 hover:bg-sand-200 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>}{isAdmin && <button onClick={() => removePayment(p)} title="حذف" className="rounded-lg p-1.5 text-slate-400 hover:bg-coral-50 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button>}</div></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-sand-50 font-bold"><td colSpan={3}>جمع</td><td className="num text-brand-800">{formatMoney(t.patientPayments)}</td><td colSpan={4} /></tr></tfoot>
                </table>
              </div>
            ) : <EmptyState title="پرداختی برای این روز ثبت نشده" />}
          </Card>

          {/* تراکنش‌های دیگر */}
          <Card title="تراکنش‌های دیگر صندوق" subtitle="بیمه، جابه‌جایی کارت مدیر، هزینه‌های نقدی و هر ورود/خروجی که به مراجع خاصی وصل نیست" padded={false} actions={<Button size="sm" variant="secondary" onClick={() => setCashOpen(true)} icon={<Plus className="h-4 w-4" />}>ثبت تراکنش</Button>}>
            {data.cashEntries.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>ساعت</th><th>نوع</th><th>روش</th><th>مبلغ</th><th>دلیل</th><th>درمانگر</th><th className="print:hidden" /></tr></thead>
                  <tbody>
                    {data.cashEntries.map((c: any) => (
                      <tr key={c.id}>
                        <td className="num text-xs">{formatTime(c.date)}</td>
                        <td>{c.direction === "IN" ? <Badge tone="sage"><ArrowDownToLine className="h-3 w-3" />دریافت</Badge> : <Badge tone="coral"><ArrowUpFromLine className="h-3 w-3" />پرداخت</Badge>}</td>
                        <td className="text-xs">{METHOD_EMOJI[c.method]} {methodLabel(c.method)}</td>
                        <td className={cn("num font-bold", c.direction === "IN" ? "text-sage-700" : "text-coral-600")}>{c.direction === "OUT" ? "−" : ""}{formatMoney(c.amount)}</td>
                        <td className="text-xs">{c.reason}{c.note ? <span className="text-slate-400"> · {c.note}</span> : null}</td>
                        <td className="text-xs text-slate-500">{c.therapistName ?? "-"}</td>
                        <td className="print:hidden"><button onClick={() => removeCash(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-coral-50 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="px-5 py-4 text-xs text-slate-400">تراکنش دیگری ثبت نشده.</p>}
          </Card>

          {!!data.walletDeposits.length && (
            <Card title="شارژ کیف پول" subtitle={formatMoney(t.walletDeposits)} padded={false}>
              <ul className="divide-y divide-sand-100 text-sm">{data.walletDeposits.map((w: any) => <li key={w.id} className="flex items-center justify-between px-5 py-2"><span>{w.patientName}<span className="text-xs text-slate-400"> · {w.description ?? ""}</span></span><span className="num font-bold">{formatMoney(w.amount)}</span></li>)}</ul>
            </Card>
          )}

          {/* جلسات روز */}
          <Card title="جلسات این روز (کارکرد)" subtitle="کارکرد درمانگر را همین‌جا می‌توانید تغییر دهید؛ برای تغییر مبلغ جلسه، وضعیت یا زمان روی مداد بزنید" padded={false}>
            {data.sessions.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>ساعت</th><th>مراجع</th><th>درمانگر</th><th>نوع</th><th>وضعیت</th><th>مبلغ جلسه</th><th>کارکرد درمانگر</th><th>تسویه</th><th>مانده حساب</th><th className="print:hidden" /></tr></thead>
                  <tbody>
                    {data.sessions.map((s: any) => (
                      <tr key={s.id} className={cn(s.status === "DONE" && !s.settled && "bg-coral-50/40")}>
                        <td className="num text-xs">{formatTime(s.startAt)}</td>
                        <td><Link href={`/panel/patients/${s.patientId}`} className="font-medium hover:text-brand-700">{s.patientName}</Link><span className="num mr-2 text-xs text-slate-400">{s.fileNumber}</span></td>
                        <td className="text-xs">{s.therapistName}</td>
                        <td>{s.kind === "ASSESSMENT" ? <Badge tone="violet">ارزیابی</Badge> : <span className="text-xs text-slate-400">درمانی</span>}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td className="num text-xs">{formatMoney(s.price)}</td>
                        <td className="print:hidden"><TherapistAmountCell value={s.therapistAmount} onSave={(v) => saveTherapistAmount(s, v)} disabled={s.status === "CANCELLED"} /></td>
                        <td>{s.status === "DONE" ? (s.settled ? <Badge tone="sage">تسویه‌شده</Badge> : <Badge tone="coral">تسویه‌نشده</Badge>) : s.status === "CANCELLED" || s.status === "NO_SHOW" ? <span className="text-xs text-slate-300">-</span> : <Badge tone="amber">در انتظار انجام</Badge>}</td>
                        <td className={cn("num text-xs", s.balance > 0 ? "text-coral-600" : s.balance < 0 ? "text-sage-700" : "text-slate-400")}>{s.balance > 0 ? `بدهکار ${formatMoney(s.balance)}` : s.balance < 0 ? `بستانکار ${formatMoney(-s.balance)}` : "تسویه"}</td>
                        <td className="print:hidden"><div className="flex gap-1">{s.status !== "CANCELLED" && !(s.status === "DONE" && s.settled) && <button onClick={() => setSettle(s.id)} className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-700">تسویه</button>}<button onClick={() => setEditAppt(s)} title="ویرایش جلسه" className="rounded-lg p-1.5 text-slate-400 hover:bg-sand-200 hover:text-brand-700"><Pencil className="h-4 w-4" /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="برای این روز جلسه‌ای ثبت نشده" />}
          </Card>

          <p className="hidden text-xs text-slate-400 print:block">چاپ در {formatJalali(new Date())} · {SETTLE_METHODS.map((m) => `${m.emoji} ${m.label}`).join(" · ")}</p>
        </div>
      )}
      {settle && <SettleModal appointmentId={settle} onClose={() => setSettle(null)} onDone={refresh} />}
      {editPay && <EditPaymentModal payment={editPay} onClose={() => setEditPay(null)} onDone={() => { setEditPay(null); refresh(); }} />}
      {editAppt && <AppointmentModal open onClose={() => setEditAppt(null)} initial={{ id: editAppt.id, patientId: editAppt.patientId, patientLabel: `${editAppt.patientName} (${editAppt.fileNumber})`, therapistId: editAppt.therapistId, startAt: editAppt.startAt, durationMin: Math.round((new Date(editAppt.endAt).getTime() - new Date(editAppt.startAt).getTime()) / 60000), price: editAppt.price, therapistAmount: editAppt.therapistAmount, kind: editAppt.kind, status: editAppt.status }} onSaved={() => { setEditAppt(null); refresh(); }} onSettle={() => { setSettle(editAppt.id); setEditAppt(null); }} />}
      {cashOpen && <CashModal date={date} onClose={() => setCashOpen(false)} onDone={() => { setCashOpen(false); refresh(); }} />}
    </>
  );
}

/** سلول کارکرد درمانگر: با کلیک قابل ویرایش، با Enter یا خروج ذخیره می‌شود */
function TherapistAmountCell({ value, onSave, disabled }: { value: number; onSave: (v: string) => void; disabled?: boolean }) {
  const [v, setV] = useState(String(value ?? ""));
  useEffect(() => setV(String(value ?? "")), [value]);
  if (disabled) return <span className="num text-xs text-slate-300">-</span>;
  return <div className="w-32"><MoneyInput value={v} onChange={setV} onBlur={() => onSave(v)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className="h-8 py-1 text-xs" /></div>;
}

function EditPaymentModal({ payment, onClose, onDone }: { payment: any; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ amount: String(payment.amount), method: payment.method, reference: payment.reference ?? "", note: payment.note ?? "", date: new Date(payment.date) as Date | null });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    try { await api.patch(`/finance/payments/${payment.id}`, { amount: Number(v.amount), method: v.method, reference: v.reference || null, note: v.note || null, date: v.date?.toISOString() }); toast.success("تسویه اصلاح شد"); onDone(); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title={`ویرایش تسویه — ${payment.patientName}`} size="sm" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={save}>ذخیره</Button></>}>
      <div className="space-y-3">
        <Field label="روش پرداخت">
          <div className="grid grid-cols-3 gap-2">
            {SETTLE_METHODS.map((m) => <button key={m.key} type="button" onClick={() => setV({ ...v, method: m.key })} className={cn("flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-xs font-medium", v.method === m.key ? "border-brand-600 bg-brand-50 text-brand-800" : "border-sand-200 bg-white text-slate-600")}><span className="text-xl leading-none">{m.emoji}</span>{m.label}</button>)}
          </div>
          {!["CASH", "CARD", "TRANSFER"].includes(v.method) && <p className="mt-1 text-xs text-slate-400">روش فعلی: {methodLabel(v.method)}</p>}
        </Field>
        <Field label="مبلغ" required><MoneyInput value={v.amount} onChange={(d) => setV({ ...v, amount: d })} suffix="تومان" /></Field>
        <Field label="تاریخ"><JalaliDatePicker value={v.date} onChange={(d) => setV({ ...v, date: d })} withTime /></Field>
        <Field label="شماره پیگیری"><Input value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} className="num" dir="ltr" /></Field>
        <Field label="توضیح"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function CashModal({ date, onClose, onDone }: { date: Date; onClose: () => void; onDone: () => void }) {
  const { data: therapists } = useTherapists();
  const [v, setV] = useState({ direction: "IN", amount: "", method: "CARD", reason: "", note: "", therapistId: "", patientId: "", patientLabel: "" });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!v.amount) return toast.error("مبلغ را وارد کنید");
    if (!v.reason.trim()) return toast.error("دلیل را بنویسید");
    setLoading(true);
    try {
      const d = new Date(date); const now = new Date(); if (startOfDay(now).getTime() === d.getTime()) d.setHours(now.getHours(), now.getMinutes()); else d.setHours(12, 0);
      const r = await api.post<any>("/finance/cash", { date: d.toISOString(), direction: v.direction, amount: Number(v.amount), method: v.method, reason: v.reason, note: v.note || undefined, therapistId: v.therapistId || undefined, patientId: v.patientId || undefined });
      toast.success(r.payment ? `در حساب ${r.payment.patientName} ثبت شد${r.summary.balance < 0 ? `؛ بستانکار ${formatMoney(-r.summary.balance)}` : r.summary.balance > 0 ? `؛ مانده بدهی ${formatMoney(r.summary.balance)}` : "؛ تسویه ✅"}` : "تراکنش ثبت شد");
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="ثبت تراکنش دیگر" size="sm" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={save}>ثبت</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setV({ ...v, direction: "IN" })} className={cn("rounded-2xl border-2 p-3 text-sm font-bold", v.direction === "IN" ? "border-sage-500 bg-sage-100 text-sage-700" : "border-sand-200 bg-white text-slate-600")}>دریافت / ورود پول</button>
          <button type="button" onClick={() => setV({ ...v, direction: "OUT", patientId: "", patientLabel: "" })} className={cn("rounded-2xl border-2 p-3 text-sm font-bold", v.direction === "OUT" ? "border-coral-500 bg-coral-100 text-coral-700" : "border-sand-200 bg-white text-slate-600")}>پرداخت / خروج پول</button>
        </div>
        <Field label="روش">
          <div className="grid grid-cols-3 gap-2">
            {SETTLE_METHODS.map((m) => <button key={m.key} type="button" onClick={() => setV({ ...v, method: m.key })} className={cn("flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-xs font-medium", v.method === m.key ? "border-brand-600 bg-brand-50 text-brand-800" : "border-sand-200 bg-white text-slate-600")}><span className="text-xl leading-none">{m.emoji}</span>{m.label}</button>)}
          </div>
        </Field>
        <Field label="مبلغ" required><MoneyInput value={v.amount} onChange={(d) => setV({ ...v, amount: d })} suffix="تومان" autoFocus /></Field>
        <Field label="دلیل" required><Input value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder="مثلاً: پرداخت بیمه، جابه‌جایی کارت مدیر، خرید لوازم…" /></Field>
        {v.direction === "IN" && <Field label="نسبت‌دادن به مراجع" hint="اگر این مبلغ از طرف مراجع است (مثلاً زودتر کارت کشیده)، به حساب او می‌نشیند و بدهی/بستانکاری‌اش دقیق می‌شود"><PatientPicker value={v.patientId} initialLabel={v.patientLabel} onChange={(id, p) => setV({ ...v, patientId: id ?? "", patientLabel: p ? `${p.fullName} (${p.fileNumber})` : "" })} /></Field>}
        {!v.patientId && <Field label="مربوط به درمانگر" hint="اختیاری"><Select value={v.therapistId} onChange={(e) => setV({ ...v, therapistId: e.target.value })}><option value="">—</option>{therapists?.items.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select></Field>}
        <Field label="توضیح بیشتر"><Textarea value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} className="min-h-[50px]" /></Field>
      </div>
    </Modal>
  );
}

export default function DailyPage() {
  return <Suspense><Inner /></Suspense>;
}

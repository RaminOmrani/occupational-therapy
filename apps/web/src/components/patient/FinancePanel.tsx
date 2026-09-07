"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Wallet, Receipt, BellRing, Printer, Percent, Trash2, CreditCard, Copy, Check, X, Clock } from "lucide-react";
import { usePublicSettings } from "@/lib/settings";
import { formatJalali, formatMoney, toPersianDigits, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, WALLET_TX_TYPES, WALLET_TX_LABELS } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Stat, Tabs, Textarea, Toggle, useConfirm } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";

export function FinancePanel({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SECRETARY";
  const isAdmin = user?.role === "ADMIN";
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["finance", patientId], queryFn: () => api.get<any>(`/finance/patients/${patientId}`) });
  const [tab, setTab] = useState<"invoices" | "payments" | "wallet" | "discounts">("invoices");
  const [modal, setModal] = useState<"invoice" | "payment" | "wallet" | "discount" | "online" | "claim" | null>(null);
  const settings = usePublicSettings();
  const claims = useQuery({ queryKey: ["claims", patientId], queryFn: () => api.get<{ items: any[] }>(user?.role === "PATIENT" ? "/payments/intents" : "/payments/claims", user?.role === "PATIENT" ? undefined : { patientId }) });
  const { confirm, dialog } = useConfirm();
  const sp = useSearchParams();
  const router = useRouter();
  const payCfg = useQuery({ queryKey: ["payment-config"], queryFn: () => api.get<any>("/payments/config"), staleTime: 60_000 });
  useEffect(() => {
    const st = sp.get("payment");
    if (!st) return;
    if (st === "ok") toast.success(`پرداخت آنلاین با موفقیت انجام شد${sp.get("ref") ? ` (کد پیگیری ${sp.get("ref")})` : ""}`);
    else if (st === "cancelled") toast.info("پرداخت لغو شد");
    else toast.error("پرداخت ناموفق بود");
    router.replace(location.pathname);
    qc.invalidateQueries({ queryKey: ["finance", patientId] });
  }, [sp, router, qc, patientId]);
  const refreshClaims = () => { qc.invalidateQueries({ queryKey: ["claims", patientId] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const approveClaim = async (id: string) => { try { await api.post(`/payments/claims/${id}/approve`); toast.success("پرداخت تأیید و ثبت شد"); refresh(); refreshClaims(); } catch (e: any) { toast.error(e.message); } };
  const rejectClaim = async (id: string) => { if (!(await confirm("این اعلام پرداخت رد شود؟"))) return; try { await api.post(`/payments/claims/${id}/reject`, { reason: "پرداخت در حساب کلینیک یافت نشد" }); toast.success("رد شد"); refreshClaims(); } catch (e: any) { toast.error(e.message); } };
  const pendingClaims = (claims.data?.items ?? []).filter((c: any) => c.provider === "manual" && c.status === "PENDING");
  const cardNumber = settings.str("finance.cardNumber");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["finance", patientId] }); qc.invalidateQueries({ queryKey: ["patient", patientId] }); };
  if (isLoading || !data) return <Spinner />;
  const s = data.summary;
  const cur = data.currency;

  const debtReminder = async () => {
    try { await api.post(`/finance/patients/${patientId}/debt-reminder`); toast.success("پیامک یادآوری بدهی ارسال شد"); } catch (e: any) { toast.error(e.message); }
  };
  const deletePayment = async (id: string) => {
    if (!(await confirm("این پرداخت حذف شود؟ مانده حساب بیمار تغییر می‌کند."))) return;
    try { await api.delete(`/finance/payments/${id}`); toast.success("حذف شد"); refresh(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      {dialog}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={s.balance > 0 ? "بدهکاری" : s.balance < 0 ? "بستانکاری" : "مانده حساب"} value={s.balance === 0 ? "تسویه ✅" : formatMoney(Math.abs(s.balance), cur)} tone={s.balance > 0 ? "coral" : "sage"} icon={<Receipt className="h-6 w-6" />} hint={s.overdueAmount > 0 ? `سررسید گذشته: ${formatMoney(s.overdueAmount, cur)}` : s.nextDueDate ? `مهلت بعدی: ${formatJalali(s.nextDueDate)}` : undefined} />
        <Stat label="کیف پول" value={formatMoney(s.walletBalance, cur)} tone="brand" icon={<Wallet className="h-6 w-6" />} />
        <Stat label="مجموع پرداختی" value={formatMoney(s.totalPaid, cur)} tone="violet" icon={<Receipt className="h-6 w-6" />} hint={`${toPersianDigits(data.payments.length)} تراکنش`} />
        <Stat label="مجموع تخفیف" value={formatMoney(s.totalDiscount, cur)} tone="amber" icon={<Percent className="h-6 w-6" />} hint={`${toPersianDigits(s.openInvoices)} صورت‌حساب باز`} />
      </div>
      {user?.role === "PATIENT" && (
        <Card title={<span className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-brand-600" />پرداخت</span>} subtitle={s.balance > 0 ? `مانده بدهی شما ${formatMoney(s.balance, cur)} است` : "بدهی ندارید؛ می‌توانید کیف پول خود را شارژ کنید"}>
          <div className="grid gap-4 md:grid-cols-2">
            {payCfg.data?.enabled ? (
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
                <p className="font-bold text-brand-800">پرداخت آنلاین{payCfg.data.sandbox ? " (آزمایشی)" : ""}</p>
                <p className="mt-1 text-xs text-slate-500">با کارت بانکی از طریق درگاه امن زرین‌پال</p>
                <div className="mt-3 flex flex-wrap gap-2">{s.balance > 0 && <Button size="sm" onClick={() => setModal("online")}>پرداخت بدهی</Button>}<Button size="sm" variant="secondary" onClick={() => setModal("online")}>شارژ کیف پول</Button></div>
              </div>
            ) : (
              <div className="rounded-2xl border border-sand-200 bg-sand-50 p-4 text-sm text-slate-500"><p className="font-bold text-slate-700">پرداخت آنلاین</p><p className="mt-1 text-xs">به‌زودی فعال می‌شود</p></div>
            )}
            <div className="rounded-2xl border border-sand-200 p-4">
              <p className="font-bold">کارت‌به‌کارت</p>
              {cardNumber ? (
                <>
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-sand-100 px-3 py-2"><span className="num text-lg font-black tracking-wider" dir="ltr">{toPersianDigits(cardNumber)}</span><button onClick={() => { navigator.clipboard?.writeText(cardNumber); toast.success("شماره کارت کپی شد"); }} className="text-slate-400 hover:text-brand-600"><Copy className="h-4 w-4" /></button></div>
                  {settings.str("finance.cardOwner") && <p className="mt-1 text-xs text-slate-500">به نام {settings.str("finance.cardOwner")}</p>}
                </>
              ) : <p className="mt-1 text-xs text-slate-500">شماره کارت را از پذیرش بگیرید</p>}
              <p className="mt-2 text-xs leading-6 text-slate-500">{settings.str("finance.paymentNote")}</p>
              <Button size="sm" className="mt-3 w-full" variant="secondary" onClick={() => setModal("claim")} icon={<Check className="h-4 w-4" />}>اعلام پرداخت انجام‌شده</Button>
            </div>
          </div>
          {claims.data?.items?.length ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold text-slate-500">اعلام‌های پرداخت شما</p>
              <ul className="space-y-1 text-sm">{claims.data.items.filter((c: any) => c.provider === "manual").slice(0, 5).map((c: any) => <li key={c.id} className="flex items-center justify-between rounded-xl bg-sand-50 px-3 py-2"><span className="num">{formatJalali(c.createdAt)} · {formatMoney(c.amount, cur)}{c.refId ? ` · پیگیری ${toPersianDigits(c.refId)}` : ""}</span><StatusBadge status={c.status === "PAID" ? "PAID" : c.status === "PENDING" ? "PENDING" : "FAILED"} /></li>)}</ul>
            </div>
          ) : null}
        </Card>
      )}
      {canEdit && pendingClaims.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><Clock className="h-5 w-5 text-amber-500" />اعلام پرداخت در انتظار تأیید</span>} subtitle="بیمار اعلام کرده کارت‌به‌کارت انجام داده؛ پس از بررسی حساب، تأیید کنید" className="border-amber-400/40">
          <ul className="space-y-2">{pendingClaims.map((c: any) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-sm">
              <span className="num">{formatJalali(c.createdAt)} · <b>{formatMoney(c.amount, cur)}</b>{c.refId ? ` · پیگیری ${toPersianDigits(c.refId)}` : ""}{c.note ? ` · ${c.note}` : ""} · {c.purpose === "WALLET" ? "شارژ کیف پول" : "بابت بدهی"}</span>
              <span className="flex gap-1"><Button size="sm" onClick={() => approveClaim(c.id)} icon={<Check className="h-4 w-4" />}>تأیید و ثبت</Button><Button size="sm" variant="secondary" onClick={() => rejectClaim(c.id)} icon={<X className="h-4 w-4" />}>رد</Button></span>
            </li>
          ))}</ul>
        </Card>
      )}
      {canEdit && payCfg.data?.enabled && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-3"><CreditCard className="h-5 w-5 text-brand-700" /><span className="text-sm">لینک پرداخت آنلاین برای بیمار{payCfg.data.sandbox ? " (آزمایشی)" : ""}:</span><Button size="sm" variant="secondary" onClick={() => setModal("online")}>ایجاد پرداخت</Button></div>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal("payment")} icon={<Plus className="h-4 w-4" />}>ثبت پرداخت</Button>
          <Button variant="secondary" onClick={() => setModal("invoice")} icon={<Receipt className="h-4 w-4" />}>صورت‌حساب جدید</Button>
          <Button variant="secondary" onClick={() => setModal("wallet")} icon={<Wallet className="h-4 w-4" />}>تراکنش کیف پول</Button>
          <Button variant="secondary" onClick={() => setModal("discount")} icon={<Percent className="h-4 w-4" />}>تخفیف</Button>
          {s.balance > 0 && <Button variant="ghost" onClick={debtReminder} icon={<BellRing className="h-4 w-4" />}>پیامک یادآوری بدهی</Button>}
          <Link href={`/panel/finance/statement/${patientId}`} className="btn-ghost"><Printer className="h-4 w-4" />صورت‌حساب کلی</Link>
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "invoices", label: "صورت‌حساب‌ها", count: data.invoices.length }, { key: "payments", label: "پرداخت‌ها", count: data.payments.length }, { key: "wallet", label: "کیف پول", count: data.walletTxs.length }, { key: "discounts", label: "تخفیف‌ها", count: data.discounts.length }]} />
      <Card padded={false} className="overflow-x-auto">
        {tab === "invoices" && (data.invoices.length ? (
          <table className="table">
            <thead><tr><th>شماره</th><th>تاریخ</th><th>سررسید</th><th>مبلغ</th><th>تخفیف</th><th>پرداختی</th><th>مانده</th><th>وضعیت</th><th></th></tr></thead>
            <tbody>{data.invoices.map((i: any) => (
              <tr key={i.id}>
                <td className="num font-medium">{i.number}</td><td className="num">{formatJalali(i.date)}</td><td className="num">{formatJalali(i.dueDate)}</td>
                <td className="num">{formatMoney(i.total, "")}</td><td className="num text-amber-500">{i.discount ? formatMoney(i.discount, "") : "-"}</td><td className="num text-sage-700">{formatMoney(i.paid, "")}</td>
                <td className="num font-bold text-coral-600">{i.status === "CANCELLED" ? "-" : formatMoney(i.total - i.paid, "")}</td><td><StatusBadge status={i.status} /></td>
                <td><Link href={`/panel/finance/invoices/${i.id}`} className="text-xs text-brand-600 hover:underline">مشاهده</Link></td>
              </tr>))}</tbody>
          </table>
        ) : <EmptyState title="صورت‌حسابی وجود ندارد" />)}
        {tab === "payments" && (data.payments.length ? (
          <table className="table">
            <thead><tr><th>تاریخ</th><th>مبلغ</th><th>روش</th><th>صورت‌حساب</th><th>مرجع</th><th>دریافت‌کننده</th><th>توضیح</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>{data.payments.map((p: any) => (
              <tr key={p.id}>
                <td className="num">{formatJalali(p.date)}</td><td className="num font-bold text-sage-700">{formatMoney(p.amount, "")}</td><td>{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}</td>
                <td className="num">{p.invoice?.number ?? "-"}</td><td className="num text-xs">{p.reference ?? "-"}</td><td className="text-xs">{p.receivedBy ? `${p.receivedBy.firstName} ${p.receivedBy.lastName}` : "-"}</td><td className="text-xs text-slate-500">{p.note ?? ""}</td>
                {isAdmin && <td><button onClick={() => deletePayment(p.id)} className="text-coral-500 hover:text-coral-700"><Trash2 className="h-4 w-4" /></button></td>}
              </tr>))}</tbody>
          </table>
        ) : <EmptyState title="پرداختی ثبت نشده" />)}
        {tab === "wallet" && (data.walletTxs.length ? (
          <table className="table">
            <thead><tr><th>تاریخ</th><th>نوع</th><th>مبلغ</th><th>توضیح</th></tr></thead>
            <tbody>{data.walletTxs.map((t: any) => (
              <tr key={t.id}><td className="num">{formatJalali(t.createdAt)}</td><td>{WALLET_TX_LABELS[t.type as keyof typeof WALLET_TX_LABELS] ?? t.type}</td><td className={`num font-bold ${t.amount > 0 ? "text-sage-700" : "text-coral-600"}`}>{t.amount > 0 ? "+" : "−"}{formatMoney(Math.abs(t.amount), "")}</td><td className="text-xs text-slate-500">{t.description ?? ""}</td></tr>
            ))}</tbody>
          </table>
        ) : <EmptyState title="تراکنشی در کیف پول نیست" />)}
        {tab === "discounts" && (data.discounts.length ? (
          <table className="table">
            <thead><tr><th>عنوان</th><th>مقدار</th><th>دلیل</th><th>اعتبار</th><th>نوع</th></tr></thead>
            <tbody>{data.discounts.map((d: any) => (
              <tr key={d.id}><td className="font-medium">{d.title}</td><td className="num">{d.percent ? `${toPersianDigits(d.percent)}٪` : formatMoney(d.amount ?? 0, cur)}</td><td className="text-xs">{d.reason ?? "-"}</td><td className="num text-xs">{d.validTo ? `تا ${formatJalali(d.validTo)}` : "نامحدود"}</td><td className="text-xs">{d.patientId ? "اختصاصی" : "عمومی"}</td></tr>
            ))}</tbody>
          </table>
        ) : <EmptyState title="تخفیفی ثبت نشده" />)}
      </Card>

      {modal === "payment" && <PaymentModal patientId={patientId} invoices={data.invoices.filter((i: any) => ["ISSUED", "PARTIAL"].includes(i.status))} walletBalance={s.walletBalance} onClose={() => setModal(null)} onDone={refresh} />}
      {modal === "invoice" && <InvoiceModal patientId={patientId} onClose={() => setModal(null)} onDone={refresh} />}
      {modal === "wallet" && <WalletModal patientId={patientId} onClose={() => setModal(null)} onDone={refresh} />}
      {modal === "discount" && <DiscountModal patientId={patientId} onClose={() => setModal(null)} onDone={refresh} />}
      {modal === "claim" && <ClaimModal patientId={patientId} balance={s.balance} onClose={() => setModal(null)} onDone={refreshClaims} />}
      {modal === "online" && <OnlinePayModal patientId={patientId} balance={s.balance} minAmount={payCfg.data?.minAmount ?? 10000} onClose={() => setModal(null)} />}
    </div>
  );
}

function PaymentModal({ patientId, invoices, walletBalance, onClose, onDone }: { patientId: string; invoices: any[]; walletBalance: number; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ amount: "", method: "CASH", invoiceId: "", reference: "", note: "", date: new Date() as Date | null, sendSms: true });
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/finance/payments", { ...v, patientId, amount: Number(v.amount.replace(/[^\d]/g, "")), invoiceId: v.invoiceId || null, date: v.date?.toISOString() });
      toast.success("پرداخت ثبت شد");
      onDone();
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="ثبت پرداخت" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={submit as any}>ثبت</Button></>}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="مبلغ (تومان)" required><Input value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="num" dir="ltr" required autoFocus inputMode="numeric" /></Field>
        <Field label="روش پرداخت" hint={v.method === "WALLET" ? `موجودی کیف پول: ${formatMoney(walletBalance)}` : undefined}>
          <Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</Select>
        </Field>
        <Field label="بابت صورت‌حساب" hint="خالی = قدیمی‌ترین صورت‌حساب باز">
          <Select value={v.invoiceId} onChange={(e) => setV({ ...v, invoiceId: e.target.value })}><option value="">خودکار</option>{invoices.map((i) => <option key={i.id} value={i.id}>{i.number} — مانده {formatMoney(i.total - i.paid)}</option>)}</Select>
        </Field>
        <Field label="تاریخ"><JalaliDatePicker value={v.date} onChange={(d) => setV({ ...v, date: d })} /></Field>
        <Field label="شماره پیگیری / رسید"><Input value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} dir="ltr" className="num" /></Field>
        <Field label="توضیح"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Toggle checked={v.sendSms} onChange={(c) => setV({ ...v, sendSms: c })} label="ارسال پیامک رسید پرداخت به بیمار" /></div>
      </form>
    </Modal>
  );
}

function InvoiceModal({ patientId, onClose, onDone }: { patientId: string; onClose: () => void; onDone: () => void }) {
  const [items, setItems] = useState([{ title: "جلسه کاردرمانی", qty: 1, unitPrice: 0 }]);
  const [discount, setDiscount] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const fromSessions = async () => {
    setLoading(true);
    try { await api.post("/finance/invoices/from-sessions", { patientId, discount: Number(discount || 0), discountNote }); toast.success("صورت‌حساب از جلسات انجام‌شده ساخته شد"); onDone(); onClose(); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const submit = async () => {
    setLoading(true);
    try { await api.post("/finance/invoices", { patientId, items, discount: Number(discount || 0), discountNote, dueDate: dueDate?.toISOString(), notes }); toast.success("صورت‌حساب صادر شد"); onDone(); onClose(); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="صورت‌حساب جدید" size="lg" footer={<><Button variant="ghost" loading={loading} onClick={fromSessions}>ساخت خودکار از جلسات فاکتورنشده</Button><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={submit}>صدور</Button></>}>
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Input className="col-span-6" value={it.title} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="شرح" />
            <Input className="num col-span-2" type="number" min={1} value={it.qty} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} />
            <Input className="num col-span-3" type="number" value={it.unitPrice} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unitPrice: Number(e.target.value) } : x)))} placeholder="قیمت واحد" />
            <button type="button" className="col-span-1 text-coral-500" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="mx-auto h-4 w-4" /></button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setItems([...items, { title: "", qty: 1, unitPrice: 0 }])}>افزودن ردیف</Button>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="تخفیف (تومان)"><Input value={discount} onChange={(e) => setDiscount(e.target.value)} className="num" dir="ltr" /></Field>
          <Field label="دلیل تخفیف"><Input value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} /></Field>
          <Field label="مهلت پرداخت"><JalaliDatePicker value={dueDate} onChange={setDueDate} /></Field>
        </div>
        <Field label="توضیحات"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[50px]" /></Field>
        <div className="flex justify-between rounded-2xl bg-sand-100 px-4 py-3 text-sm"><span>جمع: <b className="num">{formatMoney(subtotal)}</b></span><span>قابل پرداخت: <b className="num text-brand-700">{formatMoney(total)}</b></span></div>
      </div>
    </Modal>
  );
}

function WalletModal({ patientId, onClose, onDone }: { patientId: string; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ amount: "", type: "DEPOSIT", description: "" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try { await api.post("/finance/wallet", { ...v, patientId, amount: Number(v.amount) }); toast.success("تراکنش کیف پول ثبت شد"); onDone(); onClose(); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="تراکنش کیف پول" size="sm" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={submit}>ثبت</Button></>}>
      <div className="space-y-3">
        <Field label="نوع"><Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>{WALLET_TX_TYPES.filter((t) => t !== "CHARGE").map((t) => <option key={t} value={t}>{WALLET_TX_LABELS[t]}</option>)}</Select></Field>
        <Field label="مبلغ (تومان)"><Input value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="num" dir="ltr" autoFocus /></Field>
        <Field label="توضیح"><Input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function DiscountModal({ patientId, onClose, onDone }: { patientId: string; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ title: "", percent: "", amount: "", reason: "", validTo: null as Date | null });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try { await api.post("/finance/discounts", { patientId, title: v.title, percent: v.percent ? Number(v.percent) : null, amount: v.amount ? Number(v.amount) : null, reason: v.reason, validTo: v.validTo?.toISOString() ?? null }); toast.success("تخفیف ثبت شد"); onDone(); onClose(); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="تخفیف اختصاصی بیمار" size="sm" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={submit}>ثبت</Button></>}>
      <div className="space-y-3">
        <Field label="عنوان" required><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="درصد"><Input value={v.percent} onChange={(e) => setV({ ...v, percent: e.target.value })} className="num" dir="ltr" /></Field>
          <Field label="یا مبلغ ثابت"><Input value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="num" dir="ltr" /></Field>
        </div>
        <Field label="دلیل"><Input value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></Field>
        <Field label="اعتبار تا"><JalaliDatePicker value={v.validTo} onChange={(d) => setV({ ...v, validTo: d })} /></Field>
      </div>
    </Modal>
  );
}

function OnlinePayModal({ patientId, balance, minAmount, onClose }: { patientId: string; balance: number; minAmount: number; onClose: () => void }) {
  const [purpose, setPurpose] = useState<"INVOICE" | "WALLET">(balance > 0 ? "INVOICE" : "WALLET");
  const [amount, setAmount] = useState(String(balance > 0 ? balance : 100000));
  const [loading, setLoading] = useState(false);
  const go = async () => {
    setLoading(true);
    try { const r = await api.post<{ url: string }>("/payments/start", { patientId, amount: Number(amount.replace(/[^\d]/g, "")), purpose }); window.location.href = r.url; } catch (e: any) { toast.error(e.message); setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="پرداخت آنلاین" size="sm" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={go} icon={<CreditCard className="h-4 w-4" />}>انتقال به درگاه</Button></>}>
      <div className="space-y-3">
        <Field label="بابت"><Select value={purpose} onChange={(e) => setPurpose(e.target.value as any)}><option value="INVOICE">پرداخت بدهی / صورت‌حساب</option><option value="WALLET">شارژ کیف پول</option></Select></Field>
        <Field label="مبلغ (تومان)" hint={`حداقل ${formatMoney(minAmount)}`}><Input value={amount} onChange={(e) => setAmount(e.target.value)} className="num" dir="ltr" autoFocus /></Field>
        <p className="text-xs text-slate-400">پس از پرداخت موفق در درگاه زرین‌پال، به همین صفحه بازمی‌گردید و مبلغ به‌صورت خودکار ثبت می‌شود.</p>
      </div>
    </Modal>
  );
}

function ClaimModal({ patientId, balance, onClose, onDone }: { patientId: string; balance: number; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ amount: String(balance > 0 ? balance : ""), reference: "", note: "", purpose: balance > 0 ? "INVOICE" : "WALLET" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    const amount = Number(v.amount.replace(/[^\d]/g, ""));
    if (!amount) return toast.error("مبلغ را وارد کنید");
    setLoading(true);
    try { await api.post("/payments/claim", { patientId, amount, reference: v.reference, note: v.note, purpose: v.purpose }); toast.success("اعلام پرداخت ثبت شد؛ پس از تأیید پذیرش در حساب شما منظور می‌شود"); onDone(); onClose(); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title="اعلام پرداخت کارت‌به‌کارت" size="sm" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={submit}>ثبت</Button></>}>
      <div className="space-y-3">
        <Field label="بابت"><Select value={v.purpose} onChange={(e) => setV({ ...v, purpose: e.target.value })}><option value="INVOICE">بدهی / صورت‌حساب</option><option value="WALLET">شارژ کیف پول</option></Select></Field>
        <Field label="مبلغ واریزی (تومان)" required><Input value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="num" dir="ltr" autoFocus inputMode="numeric" /></Field>
        <Field label="شماره پیگیری / ۴ رقم آخر کارت" hint="از رسید بانک"><Input value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} className="num" dir="ltr" /></Field>
        <Field label="توضیح"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

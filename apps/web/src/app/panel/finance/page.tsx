"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Receipt, TrendingDown, Percent, Users, Eye } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis } from "recharts";
import { INVOICE_STATUSES, INVOICE_STATUS_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, formatJalali, formatMoney, toPersianDigits, addDays } from "@toranj/shared";
import { api } from "@/lib/api";
import { Card, EmptyState, PageHeader, SearchInput, Select, Spinner, Stat, Tabs } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";

const COLORS = ["#0f8b8d", "#e76f51", "#f4a261", "#8b5cf6", "#7ba874"];

export default function FinancePage() {
  const [tab, setTab] = useState<"report" | "invoices" | "payments" | "debtors">("report");
  const [from, setFrom] = useState<Date | null>(addDays(new Date(), -30));
  const [to, setTo] = useState<Date | null>(new Date());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const range = { from: from?.toISOString(), to: to?.toISOString() };
  const report = useQuery({ queryKey: ["finance-report", range], queryFn: () => api.get<any>("/finance/report", range) });
  const invoices = useQuery({ queryKey: ["invoices", range, q, status], queryFn: () => api.get<{ items: any[] }>("/finance/invoices", { ...range, q, status }), enabled: tab === "invoices" });
  const payments = useQuery({ queryKey: ["payments", range, method], queryFn: () => api.get<{ items: any[]; sum: number }>("/finance/payments", { ...range, method }), enabled: tab === "payments" });
  const debtors = useQuery({ queryKey: ["debtors"], queryFn: () => api.get<any>("/patients", { debt: "debtor", pageSize: 200, status: "" }), enabled: tab === "debtors" });
  const r = report.data;

  return (
    <>
      <PageHeader title="مالی" subtitle="درآمد، صورت‌حساب‌ها، پرداخت‌ها و بدهکاران" icon={<Wallet className="h-5 w-5" />} actions={<><JalaliDatePicker value={from} onChange={setFrom} placeholder="از تاریخ" className="w-36" /><JalaliDatePicker value={to} onChange={setTo} placeholder="تا تاریخ" className="w-36" /></>} />
      {r && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="درآمد (بازه)" value={formatMoney(r.totalIncome)} icon={<Wallet className="h-6 w-6" />} tone="sage" />
          <Stat label="صورت‌حساب صادرشده" value={formatMoney(r.totalInvoiced)} icon={<Receipt className="h-6 w-6" />} />
          <Stat label="تخفیف داده‌شده" value={formatMoney(r.totalDiscount)} icon={<Percent className="h-6 w-6" />} tone="amber" />
          <Stat label="مجموع بدهی بیماران" value={formatMoney(r.totalDebt)} icon={<TrendingDown className="h-6 w-6" />} tone="coral" hint={`${toPersianDigits(r.debtorsCount)} بیمار بدهکار`} />
        </div>
      )}
      <Tabs value={tab} onChange={setTab} className="mb-5" tabs={[{ key: "report", label: "گزارش" }, { key: "invoices", label: "صورت‌حساب‌ها" }, { key: "payments", label: "پرداخت‌ها" }, { key: "debtors", label: "بدهکاران" }]} />

      {tab === "report" && (report.isLoading ? <Spinner /> : r && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="روند درآمد و صدور صورت‌حساب" className="lg:col-span-2">
            <div className="h-64" dir="ltr">
              <ResponsiveContainer>
                <AreaChart data={r.series.map((s: any) => ({ ...s, label: formatJalali(s.date).slice(5) }))}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} /><YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12, direction: "rtl" }} formatter={(v: any, n: any) => [formatMoney(v), n === "income" ? "درآمد" : "صورت‌حساب"]} />
                  <Area dataKey="invoiced" stroke="#f4a261" fill="#f4a26133" strokeWidth={2} /><Area dataKey="income" stroke="#0f8b8d" fill="#0f8b8d33" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="روش‌های پرداخت">
            <div className="h-48" dir="ltr">
              <ResponsiveContainer>
                <PieChart><Pie data={Object.entries(r.byMethod).map(([k, v]) => ({ name: PAYMENT_METHOD_LABELS[k as keyof typeof PAYMENT_METHOD_LABELS] ?? k, value: v }))} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>{Object.keys(r.byMethod).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12 }} formatter={(v: any) => formatMoney(v)} /></PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1 text-xs">{Object.entries(r.byMethod).map(([k, v], i) => <li key={k} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{PAYMENT_METHOD_LABELS[k as keyof typeof PAYMENT_METHOD_LABELS] ?? k}</span><b className="num">{formatMoney(v as number)}</b></li>)}</ul>
          </Card>
        </div>
      ))}

      {tab === "invoices" && (
        <>
          <Card className="mb-4"><div className="grid gap-3 md:grid-cols-3"><SearchInput value={q} onChange={setQ} placeholder="شماره صورت‌حساب یا نام بیمار..." className="md:col-span-2" /><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">همه وضعیت‌ها</option>{INVOICE_STATUSES.map((s) => <option key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</option>)}</Select></div></Card>
          <Card padded={false} className="overflow-x-auto">
            {invoices.isLoading ? <Spinner /> : invoices.data?.items.length ? (
              <table className="table"><thead><tr><th>شماره</th><th>بیمار</th><th>تاریخ</th><th>سررسید</th><th>مبلغ</th><th>پرداختی</th><th>مانده</th><th>وضعیت</th><th></th></tr></thead>
                <tbody>{invoices.data.items.map((i) => <tr key={i.id}><td className="num text-xs">{i.number}</td><td><Link href={`/panel/patients/${i.patientId}?tab=finance`} className="font-medium hover:text-brand-700">{i.patientName}</Link></td><td className="num">{formatJalali(i.date)}</td><td className="num">{formatJalali(i.dueDate)}</td><td className="num">{formatMoney(i.total, "")}</td><td className="num text-sage-700">{formatMoney(i.paid, "")}</td><td className="num font-bold text-coral-600">{formatMoney(Math.max(0, i.total - i.paid), "")}</td><td><StatusBadge status={i.status} /></td><td><Link href={`/panel/finance/invoices/${i.id}`} className="text-brand-600"><Eye className="h-4 w-4" /></Link></td></tr>)}</tbody></table>
            ) : <EmptyState title="صورت‌حسابی یافت نشد" />}
          </Card>
        </>
      )}

      {tab === "payments" && (
        <>
          <Card className="mb-4"><div className="flex flex-wrap items-center gap-3"><Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-48"><option value="">همه روش‌ها</option>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</Select>{payments.data && <span className="text-sm">جمع: <b className="num text-brand-700">{formatMoney(payments.data.sum)}</b></span>}</div></Card>
          <Card padded={false} className="overflow-x-auto">
            {payments.isLoading ? <Spinner /> : payments.data?.items.length ? (
              <table className="table"><thead><tr><th>تاریخ</th><th>بیمار</th><th>مبلغ</th><th>روش</th><th>صورت‌حساب</th><th>دریافت‌کننده</th><th>توضیح</th></tr></thead>
                <tbody>{payments.data.items.map((p) => <tr key={p.id}><td className="num">{formatJalali(p.date)}</td><td><Link href={`/panel/patients/${p.patientId}?tab=finance`} className="font-medium hover:text-brand-700">{p.patientName}</Link></td><td className="num font-bold text-sage-700">{formatMoney(p.amount, "")}</td><td>{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}</td><td className="num text-xs">{p.invoice?.number ?? "-"}</td><td className="text-xs">{p.receivedBy ? `${p.receivedBy.firstName} ${p.receivedBy.lastName}` : "-"}</td><td className="text-xs text-slate-500">{p.note ?? ""}</td></tr>)}</tbody></table>
            ) : <EmptyState title="پرداختی یافت نشد" />}
          </Card>
        </>
      )}

      {tab === "debtors" && (
        <Card padded={false} className="overflow-x-auto">
          {debtors.isLoading ? <Spinner /> : debtors.data?.items.length ? (
            <table className="table"><thead><tr><th>بیمار</th><th>شماره پرونده</th><th>موبایل</th><th>بدهی</th><th>سررسید گذشته</th><th>صورت‌حساب باز</th><th></th></tr></thead>
              <tbody>{debtors.data.items.sort((a: any, b: any) => b.finance.balance - a.finance.balance).map((p: any) => <tr key={p.id}><td><Link href={`/panel/patients/${p.id}?tab=finance`} className="font-medium hover:text-brand-700">{p.fullName}</Link></td><td className="num text-xs">{p.fileNumber}</td><td className="num text-xs" dir="ltr">{toPersianDigits(p.phone)}</td><td className="num font-bold text-coral-600">{formatMoney(p.finance.balance)}</td><td className="num text-xs">{p.finance.overdueAmount ? formatMoney(p.finance.overdueAmount) : "-"}</td><td className="num text-xs">{toPersianDigits(p.finance.openInvoices)}</td><td><Link href={`/panel/patients/${p.id}?tab=finance`} className="text-xs text-brand-600 hover:underline">پروفایل مالی</Link></td></tr>)}</tbody></table>
          ) : <EmptyState title="بدهکاری وجود ندارد 🎉" icon={<Users className="h-6 w-6" />} />}
        </Card>
      )}
    </>
  );
}

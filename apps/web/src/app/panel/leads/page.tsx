"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Phone, Zap, ArrowLeft, Clock } from "lucide-react";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_SOURCES, LEAD_SOURCE_LABELS, formatJalali, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Button, Card, EmptyState, Input, PageHeader, SearchInput, Select, Spinner, Tabs } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { LeadModal } from "@/components/crm/LeadModal";

function Inner() {
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [source, setSource] = useState("");
  const [followUpDue, setFollowUpDue] = useState(sp.get("followUpDue") === "1");
  const [quick, setQuick] = useState("");
  const [full, setFull] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["leads", q, status, source, followUpDue], queryFn: () => api.get<any>("/leads", { q, status, source, followUpDue: followUpDue ? 1 : "" }), placeholderData: (p) => p });
  const refresh = () => qc.invalidateQueries({ queryKey: ["leads"] });

  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.post<{ lead: any; existed: boolean }>("/leads/quick", { phone: quick });
      toast[r.existed ? "info" : "success"](r.existed ? `این شماره قبلاً به‌عنوان لید ${r.lead.leadNumber} ثبت شده` : `لید ${r.lead.leadNumber} ساخته شد`);
      setQuick("");
      refresh();
    } catch (err: any) { toast.error(err.message); }
  };
  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((a: number, b: any) => a + b, 0) as number;

  return (
    <>
      <PageHeader title="لیدها (CRM)" subtitle="از تماس اول تا تبدیل به بیمار" icon={<UserPlus className="h-5 w-5" />} actions={<Button variant="secondary" onClick={() => setFull(true)} icon={<UserPlus className="h-4 w-4" />}>لید کامل</Button>} />
      <Card className="mb-5 border-brand-200 bg-gradient-to-l from-brand-50 to-white">
        <form onSubmit={quickAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex-1"><label className="label flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-amber-500" />ثبت سریع لید: فقط شماره موبایل را وارد کنید</label><Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="09123456789" dir="ltr" className="num text-left text-lg" autoFocus /></div>
          <Button type="submit" size="lg" disabled={quick.replace(/\D/g, "").length < 10}>ثبت لید</Button>
        </form>
      </Card>
      <Tabs value={status} onChange={setStatus} className="mb-4" tabs={[{ key: "", label: "همه", count: total }, ...LEAD_STATUSES.map((s) => ({ key: s, label: LEAD_STATUS_LABELS[s], count: counts[s] ?? 0 }))]} />
      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <SearchInput value={q} onChange={setQ} placeholder="نام، شماره لید یا موبایل..." className="md:col-span-2" />
          <Select value={source} onChange={(e) => setSource(e.target.value)}><option value="">همه منابع</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>)}</Select>
          <button onClick={() => setFollowUpDue(!followUpDue)} className={cn("btn", followUpDue ? "bg-amber-400 text-white" : "border border-sand-300 bg-white text-slate-600")}><Clock className="h-4 w-4" />موعد پیگیری رسیده</button>
        </div>
      </Card>
      <Card padded={false} className="overflow-x-auto">
        {isLoading && !data ? <Spinner /> : data?.items.length ? (
          <table className="table">
            <thead><tr><th>شماره لید</th><th>نام</th><th>موبایل</th><th>منبع</th><th>علاقه‌مندی</th><th>وضعیت</th><th>پیگیری بعدی</th><th>مسئول</th><th>ثبت</th><th></th></tr></thead>
            <tbody>{data.items.map((l: any) => {
              const due = l.followUpAt && new Date(l.followUpAt) <= new Date() && !["CONVERTED", "LOST"].includes(l.status);
              return (
                <tr key={l.id}>
                  <td className="num text-xs">{l.leadNumber}</td>
                  <td><Link href={`/panel/leads/${l.id}`} className="font-medium hover:text-brand-700">{l.fullName.trim() || "ناشناس"}</Link></td>
                  <td className="num text-xs" dir="ltr"><a href={`tel:${l.phone}`} className="flex items-center gap-1"><Phone className="h-3 w-3" />{toPersianDigits(l.phone)}</a></td>
                  <td className="text-xs">{LEAD_SOURCE_LABELS[l.source as keyof typeof LEAD_SOURCE_LABELS] ?? l.source}</td>
                  <td className="max-w-[200px] truncate text-xs text-slate-500">{l.interest ?? "-"}</td>
                  <td><StatusBadge status={l.status} /></td>
                  <td className={cn("num text-xs", due && "font-bold text-coral-600")}>{l.followUpAt ? formatJalali(l.followUpAt) : "-"}</td>
                  <td className="text-xs">{l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : "-"}</td>
                  <td className="num text-xs text-slate-400">{formatJalali(l.createdAt)}</td>
                  <td>{l.patient ? <Link href={`/panel/patients/${l.patient.id}`} className="text-xs text-sage-700 hover:underline">{l.patient.fileNumber}</Link> : <Link href={`/panel/patients/new?leadId=${l.id}`} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">تبدیل به بیمار<ArrowLeft className="h-3 w-3" /></Link>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <EmptyState title="لیدی یافت نشد" description="با ثبت سریع شماره موبایل شروع کنید" />}
      </Card>
      {full && <LeadModal onClose={() => setFull(false)} onDone={() => { setFull(false); refresh(); }} />}
    </>
  );
}

export default function LeadsPage() {
  return <Suspense><Inner /></Suspense>;
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, Check, X, Phone, Globe } from "lucide-react";
import { formatJalaliLong, formatTime, formatJalaliDateTime, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, Tabs, useConfirm } from "@/components/ui";

export default function BookingsPage() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const [status, setStatus] = useState("PENDING");
  const { data, isLoading } = useQuery({ queryKey: ["bookings", status], queryFn: () => api.get<{ items: any[]; pendingCount: number }>("/bookings", { status }), refetchInterval: 30_000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["bookings"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const approve = async (id: string) => { try { const r = await api.post<any>(`/bookings/${id}/approve`); toast.success("نوبت ثبت و پیامک تأیید ارسال شد"); refresh(); } catch (e: any) { toast.error(e.message); } };
  const reject = async (id: string) => { if (!(await confirm("این درخواست رد شود؟ پیامک اطلاع‌رسانی برای متقاضی ارسال می‌شود."))) return; try { await api.post(`/bookings/${id}/reject`); toast.success("رد شد"); refresh(); } catch (e: any) { toast.error(e.message); } };
  return (
    <>
      {dialog}
      <PageHeader title="درخواست‌های نوبت آنلاین" subtitle="رزروهای ثبت‌شده از سایت؛ با تأیید، پرونده (در صورت نبود) و نوبت ساخته می‌شود" icon={<Globe className="h-5 w-5" />} />
      <Tabs value={status} onChange={setStatus} className="mb-5" tabs={[{ key: "PENDING", label: "در انتظار", count: data?.pendingCount }, { key: "APPROVED", label: "تأییدشده" }, { key: "REJECTED", label: "ردشده" }]} />
      {isLoading ? <Spinner /> : data?.items.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((b) => (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{b.fullName}</p>
                  <a href={`tel:${b.phone}`} className="num flex items-center gap-1 text-xs text-slate-500" dir="ltr"><Phone className="h-3 w-3" />{toPersianDigits(b.phone)}</a>
                  <p className="mt-2 text-sm"><span className="font-bold text-brand-700">{formatJalaliLong(b.startAt, true)}</span> ساعت <span className="num font-bold">{formatTime(b.startAt)}</span></p>
                  <p className="text-xs text-slate-500">با {b.therapistName}{b.note ? ` · ${b.note}` : ""}</p>
                  <p className="mt-1 text-[11px] text-slate-400">ثبت: {formatJalaliDateTime(b.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {b.patientId ? <Link href={`/panel/patients/${b.patientId}`} className="text-xs text-brand-600 hover:underline">پرونده موجود</Link> : <Badge tone="amber">مراجع جدید</Badge>}
                  {b.status === "PENDING" ? (
                    <div className="flex gap-1"><Button size="sm" onClick={() => approve(b.id)} icon={<Check className="h-4 w-4" />}>تأیید</Button><Button size="sm" variant="secondary" onClick={() => reject(b.id)} icon={<X className="h-4 w-4" />}>رد</Button></div>
                  ) : <Badge tone={b.status === "APPROVED" ? "sage" : "slate"}>{b.status === "APPROVED" ? "تأیید شده" : "رد شده"}</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : <EmptyState title={status === "PENDING" ? "درخواست جدیدی نیست" : "موردی نیست"} icon={<CalendarPlus className="h-6 w-6" />} />}
    </>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cake, Gift, MessageSquareText } from "lucide-react";
import { formatJalali, toPersianDigits, ageFromBirthDate } from "@toranj/shared";
import { api } from "@/lib/api";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Select, Spinner } from "@/components/ui";

export default function BirthdaysPage() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery({ queryKey: ["birthdays", days], queryFn: () => api.get<{ items: any[] }>("/patients/birthdays", { days }) });
  const [sending, setSending] = useState(false);
  const sendAll = async () => {
    if (!data?.items.length) return;
    setSending(true);
    try {
      const r = await api.post<{ total: number }>("/sms/campaigns", { name: `تبریک تولد (${toPersianDigits(days)} روز آینده)`, message: "{{name}} عزیز، تولدتان را پیشاپیش تبریک می‌گوییم و برایتان سلامتی و شادی آرزو داریم. 🎂", filters: { audience: "patients", birthdayWithin: days } });
      toast.success(`ارسال به ${toPersianDigits(r.total)} نفر آغاز شد`);
    } catch (e: any) { toast.error(e.message); } finally { setSending(false); }
  };
  return (
    <>
      <PageHeader title="تولدهای نزدیک" subtitle="بیمارانی که به‌زودی تولد دارند؛ فرصت خوبی برای ارسال پیام و تخفیف" icon={<Cake className="h-5 w-5" />} actions={<><Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-40">{[3, 7, 14, 30].map((d) => <option key={d} value={d}>{toPersianDigits(d)} روز آینده</option>)}</Select><Button onClick={sendAll} loading={sending} disabled={!data?.items.length} icon={<MessageSquareText className="h-4 w-4" />}>پیامک تبریک گروهی</Button></>} />
      {isLoading ? <Spinner /> : data?.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => (
            <Card key={p.id} className="flex items-center gap-4">
              <Avatar name={p.fullName} size="lg" />
              <div className="min-w-0 flex-1">
                <Link href={`/panel/patients/${p.id}`} className="font-bold hover:text-brand-700">{p.fullName}</Link>
                <p className="num text-xs text-slate-400">{formatJalali(p.birthDate)} · {toPersianDigits((ageFromBirthDate(p.birthDate) ?? 0) + (p.daysToBirthday === 0 ? 0 : 1))} ساله می‌شود</p>
                <p className="num text-xs text-slate-400" dir="ltr">{toPersianDigits(p.phone)}</p>
              </div>
              <Badge tone={p.daysToBirthday === 0 ? "coral" : p.daysToBirthday <= 3 ? "amber" : "slate"}>{p.daysToBirthday === 0 ? <><Gift className="h-3 w-3" />امروز!</> : `${toPersianDigits(p.daysToBirthday)} روز`}</Badge>
            </Card>
          ))}
        </div>
      ) : <EmptyState title="تولدی در این بازه نیست" icon={<Cake className="h-6 w-6" />} />}
    </>
  );
}

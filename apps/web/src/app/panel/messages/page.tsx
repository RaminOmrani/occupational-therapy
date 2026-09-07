"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Plus } from "lucide-react";
import { formatJalaliDateTime, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, Card, EmptyState, Field, Modal, PageHeader, Spinner, Button, Toggle } from "@/components/ui";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { useRouter } from "next/navigation";

export default function MessagesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [all, setAll] = useState(false);
  const [pick, setPick] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["conversations", all], queryFn: () => api.get<{ items: any[] }>("/messages/conversations", { all: all ? 1 : "" }), refetchInterval: 20_000 });
  return (
    <>
      <PageHeader title="پیام‌ها" subtitle="گفتگو با بیماران بین جلسات" icon={<MessageCircle className="h-5 w-5" />} actions={<><Button onClick={() => setPick(true)} icon={<Plus className="h-4 w-4" />}>پیام جدید</Button>{user?.role === "THERAPIST" && <Toggle checked={all} onChange={setAll} label="همه بیماران" />}</>} />
      {isLoading ? <Spinner /> : data?.items.length ? (
        <Card padded={false}>
          <ul className="divide-y divide-sand-100">
            {data.items.map((c) => (
              <li key={c.patient.id}>
                <Link href={`/panel/messages/${c.patient.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/50">
                  <Avatar name={`${c.patient.firstName} ${c.patient.lastName}`} />
                  <div className="min-w-0 flex-1"><p className="font-medium">{c.patient.firstName} {c.patient.lastName} <span className="num text-xs text-slate-400">{c.patient.fileNumber}</span></p><p className="truncate text-xs text-slate-500">{c.last.body}</p></div>
                  <div className="text-left"><p className="num text-[11px] text-slate-400">{formatJalaliDateTime(c.last.createdAt)}</p>{c.unread > 0 && <span className="num mt-1 inline-block rounded-full bg-coral-500 px-2 text-xs font-bold text-white">{toPersianDigits(c.unread)}</span>}</div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : <EmptyState title="گفتگویی نیست" description="با دکمه «پیام جدید» به یک بیمار پیام بدهید" icon={<MessageCircle className="h-6 w-6" />} />}
      <Modal open={pick} onClose={() => setPick(false)} title="پیام جدید به بیمار" size="sm"><Field label="بیمار"><PatientPicker value={null} onChange={(id) => { if (id) { setPick(false); router.push(`/panel/messages/${id}`); } }} /></Field></Modal>
    </>
  );
}

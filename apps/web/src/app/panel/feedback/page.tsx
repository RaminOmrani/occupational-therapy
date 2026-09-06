"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquareHeart, Reply, Star } from "lucide-react";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, FEEDBACK_STATUSES, FEEDBACK_STATUS_LABELS, formatJalaliDateTime, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Spinner, Tabs, Textarea, Select } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";

function Inner() {
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [type, setType] = useState("");
  const [reply, setReply] = useState<any | null>(null);
  const [text, setText] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["feedbacks", status, type], queryFn: () => api.get<{ items: any[] }>("/feedback", { status, type }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["feedbacks"] });
  const send = async () => { try { await api.patch(`/feedback/${reply.id}`, { reply: text }); toast.success("پاسخ ثبت و به بیمار اعلان شد"); setReply(null); setText(""); refresh(); } catch (e: any) { toast.error(e.message); } };
  const mark = async (id: string, s: string) => { await api.patch(`/feedback/${id}`, { status: s }); refresh(); };
  return (
    <>
      <PageHeader title="انتقادات و پیشنهادات" subtitle="صدای مراجعان؛ پاسخ شما در پنل بیمار نمایش داده می‌شود" icon={<MessageSquareHeart className="h-5 w-5" />} actions={<Select value={type} onChange={(e) => setType(e.target.value)} className="w-40"><option value="">همه انواع</option>{FEEDBACK_TYPES.map((t) => <option key={t} value={t}>{FEEDBACK_TYPE_LABELS[t]}</option>)}</Select>} />
      <Tabs value={status} onChange={setStatus} className="mb-5" tabs={[{ key: "", label: "همه" }, ...FEEDBACK_STATUSES.map((s) => ({ key: s, label: FEEDBACK_STATUS_LABELS[s] }))]} />
      {isLoading ? <Spinner /> : data?.items.length ? (
        <div className="space-y-4">
          {data.items.map((f) => (
            <Card key={f.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 font-bold"><Badge tone={f.type === "COMPLAINT" ? "coral" : f.type === "PRAISE" ? "sage" : "amber"}>{FEEDBACK_TYPE_LABELS[f.type as keyof typeof FEEDBACK_TYPE_LABELS]}</Badge>{f.subject}</h3>
                  <p className="mt-1 text-xs text-slate-400">{f.patient ? <Link href={`/panel/patients/${f.patientId}`} className="text-brand-600 hover:underline">{f.patient.firstName} {f.patient.lastName} ({f.patient.fileNumber})</Link> : f.guestName ? `${f.guestName} (مهمان سایت${f.guestPhone ? ` · ${toPersianDigits(f.guestPhone)}` : ""})` : "ناشناس"} · {formatJalaliDateTime(f.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">{f.rating && <span className="flex items-center gap-0.5 text-amber-500">{Array.from({ length: f.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</span>}<StatusBadge status={f.status} /></div>
              </div>
              <p className="mt-3 text-sm leading-7">{f.message}</p>
              {f.reply && <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm"><p className="mb-1 text-xs text-brand-700">پاسخ {f.repliedBy ? `${f.repliedBy.firstName} ${f.repliedBy.lastName}` : ""} · {formatJalaliDateTime(f.repliedAt)}</p>{f.reply}</div>}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setReply(f); setText(f.reply ?? ""); }} icon={<Reply className="h-4 w-4" />}>{f.reply ? "ویرایش پاسخ" : "پاسخ"}</Button>
                {f.status === "OPEN" && <Button size="sm" variant="ghost" onClick={() => mark(f.id, "REVIEWED")}>علامت به‌عنوان بررسی‌شده</Button>}
              </div>
            </Card>
          ))}
        </div>
      ) : <EmptyState title="بازخوردی نیست" icon={<MessageSquareHeart className="h-6 w-6" />} />}
      {reply && <Modal open onClose={() => setReply(null)} title={`پاسخ به «${reply.subject}»`} footer={<><Button variant="secondary" onClick={() => setReply(null)}>انصراف</Button><Button onClick={send} disabled={!text.trim()}>ثبت پاسخ</Button></>}><Field label="متن پاسخ"><Textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus className="min-h-[120px]" /></Field></Modal>}
    </>
  );
}
export default function FeedbackPage() {
  return <Suspense><Inner /></Suspense>;
}

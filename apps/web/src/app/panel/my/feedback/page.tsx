"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquareHeart, Send, Star } from "lucide-react";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, formatJalaliLong } from "@toranj/shared";
import { api } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Spinner, Textarea } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

export default function MyFeedbackPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-feedback"], queryFn: () => api.get<{ items: any[] }>("/feedback") });
  const [v, setV] = useState({ type: "SUGGESTION", subject: "", message: "", rating: 0 });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!v.subject.trim() || !v.message.trim()) return toast.error("موضوع و متن پیام الزامی است");
    setLoading(true);
    try { await api.post("/feedback", { ...v, rating: v.rating || null }); toast.success("پیام شما ثبت شد؛ سپاسگزاریم"); setV({ type: "SUGGESTION", subject: "", message: "", rating: 0 }); qc.invalidateQueries({ queryKey: ["my-feedback"] }); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <>
      <PageHeader title="انتقاد و پیشنهاد" subtitle="نظر شما مستقیم به مدیریت کلینیک می‌رسد و پاسخ در همین‌جا نمایش داده می‌شود" icon={<MessageSquareHeart className="h-5 w-5" />} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="ثبت پیام جدید" className="lg:col-span-1">
          <div className="mb-3 flex gap-1">{FEEDBACK_TYPES.map((t) => <button key={t} type="button" onClick={() => setV({ ...v, type: t })} className={cn("flex-1 rounded-xl border py-2 text-sm transition", v.type === t ? "border-brand-600 bg-brand-600 text-white" : "border-sand-300")}>{FEEDBACK_TYPE_LABELS[t]}</button>)}</div>
          <Field label="موضوع" required><Input value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} /></Field>
          <Field label="متن پیام" required className="mt-3"><Textarea value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} className="min-h-[120px]" /></Field>
          <Field label="رضایت کلی از کلینیک" className="mt-3"><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setV({ ...v, rating: v.rating === n ? 0 : n })}><Star className={cn("h-7 w-7 transition", v.rating >= n ? "fill-amber-400 text-amber-400" : "text-sand-300")} /></button>)}</div></Field>
          <Button className="mt-4 w-full" loading={loading} onClick={submit} icon={<Send className="h-4 w-4" />}>ارسال</Button>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          {isLoading ? <Spinner /> : data?.items.length ? data.items.map((f) => (
            <Card key={f.id}>
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-bold"><Badge tone={f.type === "COMPLAINT" ? "coral" : f.type === "PRAISE" ? "sage" : "amber"}>{FEEDBACK_TYPE_LABELS[f.type as keyof typeof FEEDBACK_TYPE_LABELS]}</Badge>{f.subject}</h3><StatusBadge status={f.status} /></div>
              <p className="mt-2 text-sm leading-7">{f.message}</p>
              <p className="mt-1 text-xs text-slate-400">{formatJalaliLong(f.createdAt)}</p>
              {f.reply ? <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm"><p className="mb-1 text-xs font-bold text-brand-700">پاسخ کلینیک</p>{f.reply}</div> : <p className="mt-2 text-xs text-slate-400">در انتظار بررسی...</p>}
            </Card>
          )) : <EmptyState title="هنوز پیامی ثبت نکرده‌اید" icon={<MessageSquareHeart className="h-6 w-6" />} />}
        </div>
      </div>
    </>
  );
}

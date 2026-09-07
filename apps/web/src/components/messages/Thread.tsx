"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { formatJalaliDateTime, ROLE_LABELS } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Spinner, Textarea, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

/** گفتگوی یک بیمار با کلینیک؛ برای بیمار مسیر mine و برای کارکنان شناسه بیمار */
export function MessageThread({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const path = patientId === "mine" ? "/messages/mine" : `/messages/${patientId}`;
  const { data, isLoading } = useQuery({ queryKey: ["thread", patientId], queryFn: () => api.get<{ items: any[] }>(path), refetchInterval: 15_000 });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [data?.items.length]);
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try { await api.post(path === "/messages/mine" ? "/messages/mine" : path, { body: text.trim() }); setText(""); qc.invalidateQueries({ queryKey: ["thread", patientId] }); qc.invalidateQueries({ queryKey: ["msg-unread"] }); } catch (e: any) { toast.error(e.message); } finally { setSending(false); }
  };
  if (isLoading) return <Spinner />;
  return (
    <div className="flex h-[65vh] flex-col rounded-2xl border border-sand-200 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {data?.items.length ? data.items.map((m) => {
          const mine = m.senderUserId === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-soft", mine ? "rounded-bl-md bg-brand-600 text-white" : "rounded-br-md bg-sand-100 text-slate-800")}>
                {!mine && <p className={cn("mb-0.5 text-[11px] font-bold", "text-brand-700")}>{m.sender.firstName} {m.sender.lastName} · {ROLE_LABELS[m.senderRole as keyof typeof ROLE_LABELS]}</p>}
                <p className="whitespace-pre-wrap leading-6">{m.body}</p>
                <p className={cn("mt-1 text-[10px]", mine ? "text-brand-100" : "text-slate-400")}>{formatJalaliDateTime(m.createdAt)}{mine && m.readAt ? " · خوانده شد" : ""}</p>
              </div>
            </div>
          );
        }) : <EmptyState title="هنوز پیامی رد و بدل نشده" description="سؤالات خود را بین جلسات همین‌جا بپرسید" />}
        <div ref={bottom} />
      </div>
      <div className="flex items-end gap-2 border-t border-sand-200 p-3">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }} placeholder="پیام خود را بنویسید... (Ctrl+Enter برای ارسال)" className="min-h-[48px] max-h-32" rows={1} />
        <Button onClick={send} loading={sending} disabled={!text.trim()} icon={<Send className="h-4 w-4" />}>ارسال</Button>
      </div>
    </div>
  );
}

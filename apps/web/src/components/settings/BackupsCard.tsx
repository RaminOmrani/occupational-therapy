"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Download, Plus, Trash2, Info } from "lucide-react";
import { formatJalaliDateTime, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Button, Card, EmptyState, useConfirm } from "@/components/ui";

export function BackupsCard() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const { data } = useQuery({ queryKey: ["backups"], queryFn: () => api.get<{ items: any[]; dir: string }>("/backups") });
  const create = async () => { try { const r = await api.post<any>("/backups"); toast.success(`بکاپ ${r.file} ساخته شد`); qc.invalidateQueries({ queryKey: ["backups"] }); } catch (e: any) { toast.error(e.message); } };
  const remove = async (f: string) => { if (!(await confirm("این نسخه بکاپ حذف شود؟"))) return; await api.delete(`/backups/${f}`); qc.invalidateQueries({ queryKey: ["backups"] }); };
  return (
    <Card title={<span className="flex items-center gap-2"><Database className="h-5 w-5 text-brand-600" />نسخه‌های پشتیبان دیتابیس</span>} subtitle="هر شب ساعت ۳ به‌صورت خودکار ساخته می‌شود؛ می‌توانید همین حالا هم بسازید و دانلود کنید" actions={<Button size="sm" onClick={create} icon={<Plus className="h-4 w-4" />}>بکاپ الان</Button>} className="mt-5">
      {dialog}
      <p className="mb-3 flex items-start gap-1 rounded-xl bg-amber-400/10 p-3 text-xs leading-6 text-amber-700"><Info className="mt-1 h-3.5 w-3.5 shrink-0" />فایل‌های بکاپ روی همین سرور در پوشه <span className="num" dir="ltr">{data?.dir}</span> ذخیره می‌شوند. برای اطمینان، هر چند وقت یک نسخه را دانلود و جای دیگری نگه دارید. پوشه آپلودها (مدارک و تصاویر) جداگانه باید بکاپ گرفته شود.</p>
      {data?.items.length ? (
        <table className="table"><thead><tr><th>فایل</th><th>تاریخ</th><th>حجم</th><th></th></tr></thead>
          <tbody>{data.items.map((b) => <tr key={b.file}><td className="num text-xs" dir="ltr">{b.file}</td><td className="num text-xs">{formatJalaliDateTime(b.createdAt)}</td><td className="num text-xs">{toPersianDigits(Math.round(b.size / 1024))} KB</td><td className="flex gap-2"><a href={`/api/backups/${b.file}`} className="text-brand-600 hover:text-brand-800" title="دانلود"><Download className="h-4 w-4" /></a><button onClick={() => remove(b.file)} className="text-slate-400 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table>
      ) : <EmptyState title="هنوز بکاپی ساخته نشده" />}
    </Card>
  );
}

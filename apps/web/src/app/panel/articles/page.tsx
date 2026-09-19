"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Newspaper, Plus, Eye, Pencil, Trash2, Globe, Video, Mic, BookOpen, FileText, Star } from "lucide-react";
import { formatJalali, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Badge, Card, EmptyState, PageHeader, Spinner, Tabs, useConfirm } from "@/components/ui";

const TYPES: Record<string, { label: string; icon: any; tone: "brand" | "coral" | "violet" | "amber" }> = { ARTICLE: { label: "مقاله", icon: FileText, tone: "brand" }, VIDEO: { label: "ویدیو", icon: Video, tone: "coral" }, PODCAST: { label: "پادکست", icon: Mic, tone: "violet" }, BOOK: { label: "کتاب", icon: BookOpen, tone: "amber" } };

export default function ContentAdminPage() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const [type, setType] = useState<string>("");
  const { data, isLoading } = useQuery({ queryKey: ["articles-admin"], queryFn: () => api.get<{ items: any[] }>("/articles") });
  const items = (data?.items ?? []).filter((a) => !type || a.type === type);
  const remove = async (id: string) => { if (!(await confirm("این محتوا حذف شود؟"))) return; await api.delete(`/articles/${id}`); toast.success("حذف شد"); qc.invalidateQueries({ queryKey: ["articles-admin"] }); };
  const toggle = async (a: any) => { await api.patch(`/articles/${a.id}`, { published: !a.published }); qc.invalidateQueries({ queryKey: ["articles-admin"] }); };
  const counts = (data?.items ?? []).reduce((m: Record<string, number>, a) => { m[a.type] = (m[a.type] ?? 0) + 1; return m; }, {});
  return (
    <>
      {dialog}
      <PageHeader title="رسانه و محتوای سایت" subtitle="مقاله، ویدیو، پادکست و کتاب" icon={<Newspaper className="h-5 w-5" />} actions={<><Link href="/media" target="_blank" className="btn-secondary"><Globe className="h-4 w-4" />مشاهده در سایت</Link><Link href="/panel/articles/new" className="btn-primary"><Plus className="h-4 w-4" />محتوای جدید</Link></>} />
      <Tabs value={type} onChange={setType} className="mb-4" tabs={[{ key: "", label: `همه (${toPersianDigits(data?.items.length ?? 0)})` }, ...Object.entries(TYPES).map(([k, t]) => ({ key: k, label: `${t.label} (${toPersianDigits(counts[k] ?? 0)})` }))]} />
      <Card padded={false} className="overflow-x-auto">
        {isLoading ? <Spinner /> : items.length ? (
          <table className="table"><thead><tr><th>عنوان</th><th>نوع</th><th>دسته</th><th>نویسنده / منبع</th><th>وضعیت</th><th>بازدید</th><th>به‌روزرسانی</th><th></th></tr></thead>
            <tbody>{items.map((a) => { const t = TYPES[a.type] ?? TYPES.ARTICLE; return (
              <tr key={a.id}>
                <td><Link href={`/panel/articles/${a.id}`} className="flex items-center gap-2 font-medium hover:text-brand-700">{a.featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}{a.title}</Link></td>
                <td><Badge tone={t.tone}><t.icon className="h-3 w-3" />{t.label}</Badge></td>
                <td className="text-xs">{a.category ?? "-"}</td>
                <td className="text-xs">{a.authorName ?? "-"}{a.sourceName ? <span className="text-slate-400"> · {a.sourceName}</span> : null}</td>
                <td><button onClick={() => toggle(a)}><Badge tone={a.published ? "sage" : "slate"}>{a.published ? "منتشرشده" : "پیش‌نویس"}</Badge></button></td>
                <td className="num text-xs">{toPersianDigits(a.views)}</td>
                <td className="num text-xs text-slate-400">{formatJalali(a.updatedAt)}</td>
                <td className="flex gap-2">{a.published && <Link href={`/media/${encodeURIComponent(a.slug)}`} target="_blank" className="text-slate-400 hover:text-brand-600"><Eye className="h-4 w-4" /></Link>}<Link href={`/panel/articles/${a.id}`} className="text-slate-400 hover:text-brand-600"><Pencil className="h-4 w-4" /></Link><button onClick={() => remove(a.id)} className="text-slate-400 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button></td>
              </tr>); })}</tbody></table>
        ) : <EmptyState title="محتوایی نیست" action={<Link href="/panel/articles/new" className="btn-primary">محتوای جدید</Link>} />}
      </Card>
    </>
  );
}

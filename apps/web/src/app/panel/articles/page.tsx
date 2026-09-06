"use client";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Newspaper, Plus, Eye, Pencil, Trash2, Globe } from "lucide-react";
import { formatJalali, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Badge, Card, EmptyState, PageHeader, Spinner, useConfirm } from "@/components/ui";

export default function ArticlesAdminPage() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["articles-admin"], queryFn: () => api.get<{ items: any[] }>("/articles") });
  const remove = async (id: string) => { if (!(await confirm("این مقاله حذف شود؟"))) return; await api.delete(`/articles/${id}`); toast.success("حذف شد"); qc.invalidateQueries({ queryKey: ["articles-admin"] }); };
  const toggle = async (a: any) => { await api.patch(`/articles/${a.id}`, { published: !a.published }); qc.invalidateQueries({ queryKey: ["articles-admin"] }); };
  return (
    <>
      {dialog}
      <PageHeader title="مقالات سایت" subtitle="محتوای آموزشی صفحه عمومی" icon={<Newspaper className="h-5 w-5" />} actions={<><Link href="/articles" target="_blank" className="btn-secondary"><Globe className="h-4 w-4" />مشاهده در سایت</Link><Link href="/panel/articles/new" className="btn-primary"><Plus className="h-4 w-4" />مقاله جدید</Link></>} />
      <Card padded={false} className="overflow-x-auto">
        {isLoading ? <Spinner /> : data?.items.length ? (
          <table className="table"><thead><tr><th>عنوان</th><th>دسته</th><th>نویسنده</th><th>وضعیت</th><th>بازدید</th><th>به‌روزرسانی</th><th></th></tr></thead>
            <tbody>{data.items.map((a) => <tr key={a.id}><td><Link href={`/panel/articles/${a.id}`} className="font-medium hover:text-brand-700">{a.title}</Link></td><td className="text-xs">{a.category ?? "-"}</td><td className="text-xs">{a.authorName ?? "-"}</td><td><button onClick={() => toggle(a)}><Badge tone={a.published ? "sage" : "slate"}>{a.published ? "منتشرشده" : "پیش‌نویس"}</Badge></button></td><td className="num text-xs">{toPersianDigits(a.views)}</td><td className="num text-xs text-slate-400">{formatJalali(a.updatedAt)}</td><td className="flex gap-2">{a.published && <Link href={`/articles/${encodeURIComponent(a.slug)}`} target="_blank" className="text-slate-400 hover:text-brand-600"><Eye className="h-4 w-4" /></Link>}<Link href={`/panel/articles/${a.id}`} className="text-slate-400 hover:text-brand-600"><Pencil className="h-4 w-4" /></Link><button onClick={() => remove(a.id)} className="text-slate-400 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table>
        ) : <EmptyState title="مقاله‌ای نیست" action={<Link href="/panel/articles/new" className="btn-primary">مقاله جدید</Link>} />}
      </Card>
    </>
  );
}

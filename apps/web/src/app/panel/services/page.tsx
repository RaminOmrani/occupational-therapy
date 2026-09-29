"use client";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Stethoscope, Plus, Eye, Pencil, Trash2, Globe } from "lucide-react";
import { formatJalali, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Badge, Card, EmptyState, PageHeader, Spinner, useConfirm } from "@/components/ui";

export default function ServicesAdminPage() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["services-admin"], queryFn: () => api.get<{ items: any[] }>("/services") });
  const remove = async (s: any) => { if (!(await confirm(`خدمت «${s.title}» حذف شود؟ صفحه عمومی آن هم حذف می‌شود.`))) return; await api.delete(`/services/${s.id}`); toast.success("حذف شد"); qc.invalidateQueries({ queryKey: ["services-admin"] }); };
  const toggle = async (s: any) => { await api.patch(`/services/${s.id}`, { published: !s.published }); qc.invalidateQueries({ queryKey: ["services-admin"] }); };
  return (
    <>
      {dialog}
      <PageHeader title="خدمات سایت" subtitle="هر خدمت یک صفحه اختصاصی سئوشده دارد (/services/نامک)؛ عنوان، متن، پرسش‌های متداول و عنوان گوگل از همین‌جا ویرایش می‌شود" icon={<Stethoscope className="h-5 w-5" />} actions={<><Link href="/services" target="_blank" className="btn-secondary"><Globe className="h-4 w-4" />مشاهده در سایت</Link><Link href="/panel/services/new" className="btn-primary"><Plus className="h-4 w-4" />خدمت جدید</Link></>} />
      <Card padded={false} className="overflow-x-auto">
        {isLoading ? <Spinner /> : data?.items.length ? (
          <table className="table"><thead><tr><th>#</th><th>عنوان</th><th>نامک (آدرس)</th><th>عنوان گوگل</th><th>پرسش‌ها</th><th>وضعیت</th><th>به‌روزرسانی</th><th /></tr></thead>
            <tbody>{data.items.map((s, i) => (
              <tr key={s.id}>
                <td className="num text-xs text-slate-400">{toPersianDigits(s.sortOrder ?? i)}</td>
                <td><Link href={`/panel/services/${s.id}`} className="font-medium hover:text-brand-700">{s.title}</Link></td>
                <td className="text-xs text-slate-500" dir="ltr">/services/{s.slug}</td>
                <td className="max-w-[260px] truncate text-xs text-slate-500">{s.seoTitle ?? <span className="text-coral-600">تنظیم نشده</span>}</td>
                <td className="num text-xs">{toPersianDigits(s.faq.length)}</td>
                <td><button onClick={() => toggle(s)}><Badge tone={s.published ? "sage" : "slate"}>{s.published ? "منتشرشده" : "پیش‌نویس"}</Badge></button></td>
                <td className="num text-xs text-slate-400">{formatJalali(s.updatedAt)}</td>
                <td className="flex gap-2">{s.published && <Link href={`/services/${s.slug}`} target="_blank" className="text-slate-400 hover:text-brand-600"><Eye className="h-4 w-4" /></Link>}<Link href={`/panel/services/${s.id}`} className="text-slate-400 hover:text-brand-600"><Pencil className="h-4 w-4" /></Link><button onClick={() => remove(s)} className="text-slate-400 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button></td>
              </tr>))}</tbody></table>
        ) : <EmptyState title="خدمتی تعریف نشده" action={<Link href="/panel/services/new" className="btn-primary">خدمت جدید</Link>} />}
      </Card>
    </>
  );
}

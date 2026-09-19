import type { Metadata } from "next";
import Link from "next/link";
import { Video, Mic, BookOpen, FileText, LayoutGrid } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { getClinic } from "@/lib/server";
import { serverGet } from "@/lib/api";
import { ArticleCard } from "@/components/layout/ArticleCard";
import { EmptyState } from "@/components/ui";
import { toPersianDigits } from "@toranj/shared";

export async function generateMetadata(): Promise<Metadata> {
  const clinic = await getClinic();
  return { title: clinic?.settings?.["public.mediaTitle"] ?? "رسانه" };
}

const TABS = [{ key: "", label: "همه", icon: LayoutGrid }, { key: "ARTICLE", label: "مقالات", icon: FileText }, { key: "VIDEO", label: "ویدیوها", icon: Video }, { key: "PODCAST", label: "پادکست‌ها", icon: Mic }, { key: "BOOK", label: "کتاب‌ها", icon: BookOpen }];

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; type?: string }> }) {
  const sp = await searchParams;
  const clinic = await getClinic();
  const s = clinic?.settings ?? {};
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.category) qs.set("category", sp.category);
  if (sp.type) qs.set("type", sp.type);
  const data = await serverGet<{ items: any[]; categories: string[]; counts: Record<string, number> }>(`/articles/public?${qs.toString()}`);
  const link = (patch: Record<string, string | undefined>) => { const p = new URLSearchParams(); const merged = { q: sp.q, category: sp.category, type: sp.type, ...patch }; Object.entries(merged).forEach(([k, v]) => v && p.set(k, v)); const str = p.toString(); return `/media${str ? `?${str}` : ""}`; };
  const type = (sp.type ?? "").toUpperCase();
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} logo={s["clinic.logo"]} />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-black text-brand-900">{s["public.mediaTitle"] ?? "رسانه"}</h1>
        <p className="mt-2 text-slate-500">{s["public.mediaSubtitle"]}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((t) => { const n = t.key ? data?.counts?.[t.key] ?? 0 : Object.values(data?.counts ?? {}).reduce((a, b) => a + b, 0); const active = type === t.key; return <Link key={t.key} href={link({ type: t.key || undefined })} className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition ${active ? "bg-brand-600 text-white shadow-soft" : "bg-white text-slate-600 hover:bg-brand-50"}`}><t.icon className="h-4 w-4" />{t.label}<span className="num text-xs opacity-70">{toPersianDigits(n)}</span></Link>; })}
        </div>
        <form className="mt-4 flex flex-wrap gap-2">
          {sp.type && <input type="hidden" name="type" value={sp.type} />}
          <input name="q" defaultValue={sp.q} placeholder="جستجو در عنوان، متن، نویسنده..." className="input max-w-xs" />
          <button className="btn-primary">جستجو</button>
          {!!data?.categories.length && <span className="flex flex-wrap items-center gap-1 text-xs"><Link href={link({ category: undefined })} className={`badge px-3 py-2 ${!sp.category ? "bg-brand-100 text-brand-800" : "bg-sand-200"}`}>همه دسته‌ها</Link>{data.categories.map((c) => <Link key={c} href={link({ category: c })} className={`badge px-3 py-2 ${sp.category === c ? "bg-brand-100 text-brand-800" : "bg-sand-200"}`}>{c}</Link>)}</span>}
        </form>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
          {data?.items.map((a) => <ArticleCard key={a.id} a={a} />)}
        </div>
        {!data?.items.length && <EmptyState title="محتوایی یافت نشد" />}
      </div>
      <PublicFooter settings={s} />
    </div>
  );
}

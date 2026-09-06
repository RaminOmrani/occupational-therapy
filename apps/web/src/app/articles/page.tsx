import type { Metadata } from "next";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { getClinic } from "@/lib/server";
import { serverGet } from "@/lib/api";
import { ArticleCard } from "@/components/layout/ArticleCard";
import { EmptyState } from "@/components/ui";
import Link from "next/link";

export const metadata: Metadata = { title: "مقالات" };

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const sp = await searchParams;
  const clinic = await getClinic();
  const s = clinic?.settings ?? {};
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.category) qs.set("category", sp.category);
  const data = await serverGet<{ items: any[]; categories: string[] }>(`/articles/public?${qs.toString()}`);
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-black text-brand-900">مقالات و دانستنی‌ها</h1>
        <p className="mt-2 text-slate-500">مطالب آموزشی تیم درمانگران برای خانواده‌ها</p>
        <form className="mt-6 flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} placeholder="جستجو در مقالات..." className="input max-w-xs" />
          <button className="btn-primary">جستجو</button>
          <Link href="/articles" className={`badge px-3 py-2 ${!sp.category ? "bg-brand-600 text-white" : "bg-sand-200"}`}>همه</Link>
          {data?.categories.map((c) => <Link key={c} href={`/articles?category=${encodeURIComponent(c)}`} className={`badge px-3 py-2 ${sp.category === c ? "bg-brand-600 text-white" : "bg-sand-200"}`}>{c}</Link>)}
        </form>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {data?.items.map((a) => <ArticleCard key={a.id} a={a} />)}
        </div>
        {!data?.items.length && <EmptyState title="مقاله‌ای یافت نشد" />}
      </div>
      <PublicFooter settings={s} />
    </div>
  );
}

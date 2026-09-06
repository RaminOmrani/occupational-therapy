import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, CalendarDays, User } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { getClinic } from "@/lib/server";
import { serverGet } from "@/lib/api";
import { ArticleCard } from "@/components/layout/ArticleCard";
import { formatJalaliLong, toPersianDigits } from "@toranj/shared";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await serverGet<{ article: any }>(`/articles/public/${encodeURIComponent(slug)}`);
  return { title: d?.article?.title ?? "مقاله", description: d?.article?.excerpt ?? undefined };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [clinic, d] = await Promise.all([getClinic(), serverGet<{ article: any; related: any[] }>(`/articles/public/${encodeURIComponent(slug)}`)]);
  if (!d?.article) notFound();
  const a = d.article;
  const s = clinic?.settings ?? {};
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} />
      <article className="mx-auto max-w-3xl px-4 py-12">
        {a.category && <span className="badge bg-brand-100 text-brand-800">{a.category}</span>}
        <h1 className="mt-3 text-3xl font-black leading-[1.5] text-brand-900">{a.title}</h1>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          {a.authorName && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{a.authorName}</span>}
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatJalaliLong(a.publishedAt)}</span>
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{toPersianDigits(a.views)} بازدید</span>
        </div>
        {a.coverImage && <img src={a.coverImage} alt={a.title} className="mt-6 w-full rounded-3xl object-cover" />}
        <div className="prose-fa mt-8 leading-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.content}</ReactMarkdown>
        </div>
        {a.tags?.length > 0 && <div className="mt-8 flex flex-wrap gap-2">{a.tags.map((t: string) => <span key={t} className="badge bg-sand-200 text-slate-600">#{t}</span>)}</div>}
      </article>
      {d.related.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-5 text-xl font-black text-brand-900">مطالب مرتبط</h2>
          <div className="grid gap-5 md:grid-cols-3">{d.related.map((r) => <ArticleCard key={r.id} a={r} />)}</div>
        </section>
      )}
      <PublicFooter settings={s} />
    </div>
  );
}

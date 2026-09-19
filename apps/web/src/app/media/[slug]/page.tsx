import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, CalendarDays, User, Clock, Download, ExternalLink, BookOpen } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { getClinic } from "@/lib/server";
import { serverGet } from "@/lib/api";
import { ArticleCard, CONTENT_TYPES } from "@/components/layout/ArticleCard";
import { formatJalaliLong, toPersianDigits } from "@toranj/shared";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await serverGet<{ article: any }>(`/articles/public/${encodeURIComponent(slug)}`);
  return { title: d?.article?.title ?? "محتوا", description: d?.article?.excerpt ?? undefined, openGraph: d?.article?.coverImage ? { images: [d.article.coverImage] } : undefined };
}

export default async function MediaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [clinic, d] = await Promise.all([getClinic(), serverGet<{ article: any; related: any[] }>(`/articles/public/${encodeURIComponent(slug)}`)]);
  if (!d?.article) notFound();
  const a = d.article;
  const s = clinic?.settings ?? {};
  const t = CONTENT_TYPES[a.type] ?? CONTENT_TYPES.ARTICLE;
  const isBook = a.type === "BOOK";
  const body = a.format === "html" ? <div className="prose-fa mt-8 leading-8" dangerouslySetInnerHTML={{ __html: a.content }} /> : <div className="prose-fa mt-8 leading-8"><ReactMarkdown remarkPlugins={[remarkGfm]}>{a.content}</ReactMarkdown></div>;
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} logo={s["clinic.logo"]} />
      <article className={`mx-auto px-4 py-12 ${a.type === "VIDEO" ? "max-w-4xl" : "max-w-3xl"}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs"><Link href={`/media?type=${a.type}`} className={`badge ${t.cls}`}><t.icon className="h-3 w-3" />{t.label}</Link>{a.category && <span className="badge bg-sand-200 text-slate-600">{a.category}</span>}</div>
        <h1 className="mt-3 text-3xl font-black leading-[1.5] text-brand-900">{a.title}</h1>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          {a.authorName && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{a.authorName}{a.sourceName ? ` · ${a.sourceName}` : ""}</span>}
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatJalaliLong(a.publishedAt)}</span>
          {a.duration && <span className="num flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{toPersianDigits(a.duration)}</span>}
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{toPersianDigits(a.views)} بازدید</span>
        </div>

        {/* پخش‌کننده بر اساس نوع */}
        {a.type === "VIDEO" && (a.embedSrc ? <div className="media-embed mt-6 shadow-card"><iframe src={a.embedSrc} title={a.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div> : a.mediaUrl ? <video controls playsInline preload="metadata" poster={a.coverImage ?? undefined} src={a.mediaUrl} className="mt-6 w-full rounded-3xl bg-slate-900 shadow-card" /> : a.coverImage ? <img src={a.coverImage} alt={a.title} className="mt-6 w-full rounded-3xl object-cover" /> : null)}
        {a.type === "PODCAST" && (
          <div className="card mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            {a.coverImage && <img src={a.coverImage} alt={a.title} className="h-32 w-32 shrink-0 rounded-2xl object-cover" />}
            <div className="min-w-0 flex-1">{a.mediaUrl ? <audio controls preload="metadata" src={a.mediaUrl} className="w-full" /> : <p className="text-sm text-slate-400">فایل صوتی هنوز بارگذاری نشده است.</p>}{a.mediaUrl && <a href={a.mediaUrl} download className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"><Download className="h-3.5 w-3.5" />دانلود فایل</a>}</div>
          </div>
        )}
        {isBook && (
          <div className="card mt-6 flex flex-col gap-5 p-5 sm:flex-row">
            {a.coverImage ? <img src={a.coverImage} alt={a.title} className="mx-auto w-44 shrink-0 rounded-xl object-cover shadow-card sm:mx-0" /> : <span className="grid h-44 w-32 place-items-center rounded-xl bg-sand-100 text-brand-300"><BookOpen className="h-10 w-10" /></span>}
            <div className="flex-1 space-y-2 text-sm">
              {a.authorName && <p><span className="text-slate-400">نویسنده: </span>{a.authorName}</p>}
              {a.sourceName && <p><span className="text-slate-400">ناشر / منبع: </span>{a.sourceName}</p>}
              {a.duration && <p className="num"><span className="text-slate-400">مشخصات: </span>{toPersianDigits(a.duration)}</p>}
              {a.excerpt && <p className="leading-7 text-slate-600">{a.excerpt}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                {a.fileUrl && <a href={a.fileUrl} target="_blank" className="btn-primary"><Download className="h-4 w-4" />دانلود کتاب</a>}
                {a.externalUrl && <a href={a.externalUrl} target="_blank" rel="noopener" className="btn-secondary"><ExternalLink className="h-4 w-4" />تهیه / منبع</a>}
              </div>
            </div>
          </div>
        )}
        {a.type === "ARTICLE" && a.coverImage && <img src={a.coverImage} alt={a.title} className="mt-6 w-full rounded-3xl object-cover" />}

        {a.content?.trim() && body}
        {a.externalUrl && !isBook && <p className="mt-6 text-sm"><a href={a.externalUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-brand-700 hover:underline"><ExternalLink className="h-4 w-4" />مشاهده منبع اصلی</a></p>}
        {a.tags?.length > 0 && <div className="mt-8 flex flex-wrap gap-2">{a.tags.map((tag: string) => <span key={tag} className="badge bg-sand-200 text-slate-600">#{tag}</span>)}</div>}
      </article>
      {d.related.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-5 text-xl font-black text-brand-900">مطالب مرتبط</h2>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">{d.related.map((r) => <ArticleCard key={r.id} a={r} />)}</div>
        </section>
      )}
      <PublicFooter settings={s} />
    </div>
  );
}

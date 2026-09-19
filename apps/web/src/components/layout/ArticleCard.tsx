import Link from "next/link";
import { Video, Mic, BookOpen, FileText, Play, Clock } from "lucide-react";
import { formatJalaliLong, toPersianDigits } from "@toranj/shared";

export const CONTENT_TYPES: Record<string, { label: string; icon: any; cls: string }> = {
  ARTICLE: { label: "مقاله", icon: FileText, cls: "bg-brand-100 text-brand-800" },
  VIDEO: { label: "ویدیو", icon: Video, cls: "bg-coral-100 text-coral-700" },
  PODCAST: { label: "پادکست", icon: Mic, cls: "bg-violet-100 text-violet-700" },
  BOOK: { label: "کتاب", icon: BookOpen, cls: "bg-amber-400/20 text-amber-700" },
};

export function ArticleCard({ a }: { a: any }) {
  const t = CONTENT_TYPES[a.type] ?? CONTENT_TYPES.ARTICLE;
  const isBook = a.type === "BOOK";
  return (
    <Link href={`/media/${encodeURIComponent(a.slug)}`} className="group card overflow-hidden transition hover:-translate-y-1 hover:shadow-card">
      <div className={`relative bg-gradient-to-br from-brand-100 to-sand-200 ${isBook ? "flex h-56 items-center justify-center bg-sand-100" : "h-44"}`}>
        {a.coverImage ? <img src={a.coverImage} alt={a.title} className={isBook ? "h-48 rounded-lg object-cover shadow-card" : "h-full w-full object-cover"} /> : <t.icon className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-brand-300" />}
        {(a.type === "VIDEO" || a.type === "PODCAST") && <span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-brand-700 shadow-card transition group-hover:scale-110"><Play className="mr-[-3px] h-6 w-6 fill-current" /></span></span>}
        <span className={`badge absolute right-3 top-3 ${t.cls}`}><t.icon className="h-3 w-3" />{t.label}</span>
        {a.duration && <span className="num badge absolute bottom-3 left-3 bg-black/60 text-white"><Clock className="h-3 w-3" />{toPersianDigits(a.duration)}</span>}
      </div>
      <div className="p-5">
        {a.category && <span className="badge bg-sand-200 text-slate-600">{a.category}</span>}
        <h3 className="mt-2 line-clamp-2 font-bold leading-7 text-slate-800 group-hover:text-brand-700">{a.title}</h3>
        {a.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{a.excerpt}</p>}
        <p className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>{a.authorName ?? ""}{a.sourceName ? ` · ${a.sourceName}` : ""}</span><span>{formatJalaliLong(a.publishedAt)}</span></p>
      </div>
    </Link>
  );
}

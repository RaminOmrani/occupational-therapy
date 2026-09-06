import Link from "next/link";
import { formatJalaliLong } from "@toranj/shared";

export function ArticleCard({ a }: { a: any }) {
  return (
    <Link href={`/articles/${encodeURIComponent(a.slug)}`} className="group card overflow-hidden transition hover:-translate-y-1 hover:shadow-card">
      <div className="h-40 bg-gradient-to-br from-brand-100 to-sand-200">
        {a.coverImage && <img src={a.coverImage} alt={a.title} className="h-full w-full object-cover" />}
      </div>
      <div className="p-5">
        {a.category && <span className="badge bg-brand-100 text-brand-800">{a.category}</span>}
        <h3 className="mt-2 line-clamp-2 font-bold leading-7 text-slate-800 group-hover:text-brand-700">{a.title}</h3>
        {a.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{a.excerpt}</p>}
        <p className="mt-3 text-xs text-slate-400">{formatJalaliLong(a.publishedAt)}</p>
      </div>
    </Link>
  );
}

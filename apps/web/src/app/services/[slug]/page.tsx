import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, CalendarCheck, Users, ListChecks, HelpCircle, ArrowLeft } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { serverGet } from "@/lib/api";
import { publicContext, pageMeta, JsonLd, breadcrumbJsonLd, faqJsonLd, serviceJsonLd, cityOf, cleanName } from "@/lib/seo";
import { ArticleCard } from "@/components/layout/ArticleCard";
import { toPersianDigits } from "@toranj/shared";

type Svc = { id: string; slug: string; title: string; shortDescription: string | null; content: string; audience: string | null; process: string | null; faq: { q: string; a: string }[]; coverImage: string | null; seoTitle: string | null; seoDescription: string | null; keywords: string[]; updatedAt: string };
async function load(slug: string) { return serverGet<{ service: Svc; others: { slug: string; title: string; shortDescription: string | null }[]; articles: any[] }>(`/services/public/${encodeURIComponent(slug)}`, 60); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [{ s }, d] = await Promise.all([publicContext(), load(slug)]);
  if (!d?.service) return { title: "خدمت یافت نشد" };
  const sv = d.service;
  return pageMeta(s, { title: sv.seoTitle || `${sv.title} در ${cityOf(s)}`, description: sv.seoDescription || sv.shortDescription || "", path: `/services/${sv.slug}`, image: sv.coverImage, keywords: sv.keywords, noTitleSuffix: !!sv.seoTitle });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ clinic, s }, d] = await Promise.all([publicContext(), load(slug)]);
  if (!d?.service) notFound();
  const sv = d.service;
  const city = cityOf(s);
  const name = cleanName(s);
  const hasFaq = sv.faq.length > 0;
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} logo={s["clinic.logo"]} />
      <JsonLd data={[breadcrumbJsonLd(s, [{ name: "خدمات", path: "/services" }, { name: sv.title, path: `/services/${sv.slug}` }]), serviceJsonLd(s, sv), ...(hasFaq ? [faqJsonLd(sv.faq)] : [])]} />
      <article className="mx-auto max-w-6xl px-4 py-12">
        <nav aria-label="مسیر" className="mb-4 text-xs text-slate-400"><Link href="/" className="hover:text-brand-700">خانه</Link> › <Link href="/services" className="hover:text-brand-700">خدمات</Link> › <span>{sv.title}</span></nav>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h1 className="text-3xl font-black leading-[1.5] text-brand-900">{sv.title} در {city}</h1>
            {sv.shortDescription && <p className="mt-3 text-lg leading-8 text-slate-600">{sv.shortDescription}</p>}
            {sv.coverImage && <img src={sv.coverImage} alt={`${sv.title} در ${name}`} className="mt-6 w-full rounded-3xl object-cover" />}
            <div className="prose-fa mt-6 leading-8" dangerouslySetInnerHTML={{ __html: sv.content }} />
            {sv.audience && (
              <section className="mt-10">
                <h2 className="flex items-center gap-2 text-xl font-black text-brand-900"><Users className="h-5 w-5 text-brand-600" />این خدمت برای چه کسانی مناسب است؟</h2>
                <div className="prose-fa mt-3 leading-8" dangerouslySetInnerHTML={{ __html: sv.audience }} />
              </section>
            )}
            {sv.process && (
              <section className="mt-10">
                <h2 className="flex items-center gap-2 text-xl font-black text-brand-900"><ListChecks className="h-5 w-5 text-brand-600" />روند جلسه‌ها</h2>
                <div className="prose-fa mt-3 leading-8" dangerouslySetInnerHTML={{ __html: sv.process }} />
              </section>
            )}
            {hasFaq && (
              <section className="mt-10">
                <h2 className="flex items-center gap-2 text-xl font-black text-brand-900"><HelpCircle className="h-5 w-5 text-brand-600" />پرسش‌های متداول</h2>
                <div className="mt-4 space-y-3">
                  {sv.faq.map((f, i) => (
                    <details key={i} className="card group p-4" open={i === 0}>
                      <summary className="cursor-pointer list-none font-bold text-slate-800 marker:hidden">{f.q}</summary>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
            {d.articles.length > 0 && (
              <section className="mt-12">
                <h2 className="text-xl font-black text-brand-900">مطالب مرتبط</h2>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">{d.articles.map((a) => <ArticleCard key={a.id} a={a} />)}</div>
              </section>
            )}
          </div>
          <aside className="space-y-4">
            <div className="card sticky top-24 p-5">
              <h2 className="text-lg font-black text-brand-900">شروع با یک جلسه ارزیابی</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">اولین جلسه، ارزیابی تخصصی است؛ سپس برنامه درمانی متناسب پیشنهاد می‌شود.</p>
              <div className="mt-4 flex flex-col gap-2">
                <Link href="/book" className="btn-primary w-full"><CalendarCheck className="h-4 w-4" />رزرو نوبت آنلاین</Link>
                {s["clinic.phone"] && <a href={`tel:${s["clinic.phone"]}`} className="btn-secondary w-full"><Phone className="h-4 w-4" />تماس: <span className="num" dir="ltr">{toPersianDigits(s["clinic.phone"])}</span></a>}
              </div>
              <dl className="mt-5 space-y-2 text-xs text-slate-500">
                {s["clinic.address"] && <div><dt className="font-bold text-slate-700">آدرس</dt><dd>{s["clinic.address"]}</dd></div>}
                {s["clinic.workingHours"] && <div><dt className="font-bold text-slate-700">ساعات کاری</dt><dd>{s["clinic.workingHours"]}</dd></div>}
              </dl>
            </div>
            {d.others.length > 0 && (
              <div className="card p-5">
                <h2 className="mb-3 font-black text-brand-900">سایر خدمات</h2>
                <ul className="space-y-2 text-sm">{d.others.map((o) => <li key={o.slug}><Link href={`/services/${o.slug}`} className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-brand-50 hover:text-brand-700">{o.title}<ArrowLeft className="h-4 w-4 text-slate-300" /></Link></li>)}</ul>
              </div>
            )}
          </aside>
        </div>
      </article>
      <PublicFooter settings={s} services={clinic?.services ?? []} />
    </div>
  );
}

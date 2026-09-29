import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { Avatar } from "@/components/ui";
import { publicContext, pageMeta, JsonLd, breadcrumbJsonLd, personJsonLd, cityOf, cleanName } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { s, therapists } = await publicContext();
  const names = therapists.map((t) => t.fullName).join("، ");
  return pageMeta(s, { title: `تیم درمان | کاردرمانگران ${cleanName(s)} ${cityOf(s)}`, description: `آشنایی با درمانگران کلینیک ذهن سبز در ${cityOf(s)}${names ? `: ${names}` : ""}؛ تخصص، مدارک و شماره نظام هر درمانگر.`, path: "/team", noTitleSuffix: true });
}

export default async function TeamPage() {
  const { clinic, s, therapists } = await publicContext();
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} logo={s["clinic.logo"]} />
      <JsonLd data={[breadcrumbJsonLd(s, [{ name: "تیم درمان", path: "/team" }]), ...therapists.map((t) => personJsonLd(s, t))]} />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <nav aria-label="مسیر" className="mb-4 text-xs text-slate-400"><Link href="/" className="hover:text-brand-700">خانه</Link> › <span>تیم درمان</span></nav>
        <h1 className="text-3xl font-black leading-[1.5] text-brand-900">تیم درمان کلینیک کاردرمانی و توان‌بخشی ذهن سبز {cityOf(s)}</h1>
        <p className="mt-3 max-w-3xl leading-8 text-slate-600">درمانگران کلینیک، دارای مدرک دانشگاهی کاردرمانی و شماره نظام هستند. برای آشنایی با تخصص و سوابق هر نفر، روی نامش بزنید.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {therapists.map((t) => (
            <Link key={t.id} href={`/team/${t.slug}`} className="card flex gap-4 p-5 transition hover:-translate-y-1 hover:shadow-card">
              <Avatar name={t.fullName} src={t.avatar} size="xl" />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-800">{t.fullName}</h2>
                {t.specialty && <p className="text-sm text-brand-700">{t.specialty}</p>}
                {t.credentials && <p className="mt-1 text-xs text-slate-500">{t.credentials}</p>}
                {t.bio && <p className="mt-2 line-clamp-3 text-sm leading-7 text-slate-500">{t.bio}</p>}
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700">مشاهده پروفایل <ArrowLeft className="h-4 w-4" /></span>
              </div>
            </Link>
          ))}
          {!therapists.length && <p className="text-slate-400">هنوز درمانگری برای نمایش عمومی ثبت نشده است.</p>}
        </div>
      </div>
      <PublicFooter settings={s} services={clinic?.services ?? []} />
    </div>
  );
}

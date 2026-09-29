import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Phone, BadgeCheck, GraduationCap } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { Avatar } from "@/components/ui";
import { publicContext, pageMeta, JsonLd, breadcrumbJsonLd, personJsonLd, cityOf, cleanName } from "@/lib/seo";
import { toPersianDigits } from "@toranj/shared";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { s, therapists } = await publicContext();
  const t = therapists.find((x) => x.slug === slug || x.id === slug);
  if (!t) return { title: "درمانگر یافت نشد" };
  return pageMeta(s, { title: `${t.fullName} | ${t.specialty || "کاردرمانگر"} در ${cityOf(s)}`, description: `${t.fullName}، ${t.specialty || "کاردرمانگر"} کلینیک کاردرمانی و توان‌بخشی ذهن سبز ${cityOf(s)}${t.credentials ? `؛ ${t.credentials}` : ""}. رزرو نوبت آنلاین.`, path: `/team/${t.slug}`, image: t.avatar, type: "website", noTitleSuffix: true });
}

export default async function TherapistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { clinic, s, therapists } = await publicContext();
  const t = therapists.find((x) => x.slug === slug || x.id === slug);
  if (!t) notFound();
  const services = clinic?.services ?? [];
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} logo={s["clinic.logo"]} />
      <JsonLd data={[breadcrumbJsonLd(s, [{ name: "تیم درمان", path: "/team" }, { name: t.fullName, path: `/team/${t.slug}` }]), personJsonLd(s, t)]} />
      <article className="mx-auto max-w-4xl px-4 py-12">
        <nav aria-label="مسیر" className="mb-4 text-xs text-slate-400"><Link href="/" className="hover:text-brand-700">خانه</Link> › <Link href="/team" className="hover:text-brand-700">تیم درمان</Link> › <span>{t.fullName}</span></nav>
        <div className="card flex flex-col gap-6 p-6 sm:flex-row">
          <Avatar name={t.fullName} src={t.avatar} size="xl" className="!h-32 !w-32 !text-3xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-black leading-[1.4] text-brand-900">{t.fullName}</h1>
            <p className="mt-1 text-lg text-brand-700">{t.specialty || "کاردرمانگر"} · {cleanName(s)} {cityOf(s)}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {t.credentials && <div className="flex items-start gap-2"><GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><div><dt className="text-xs text-slate-400">مدارک و تحصیلات</dt><dd className="font-medium">{t.credentials}</dd></div></div>}
              {t.licenseNo && <div className="flex items-start gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><div><dt className="text-xs text-slate-400">شماره نظام / پروانه</dt><dd className="num font-medium">{toPersianDigits(t.licenseNo)}</dd></div></div>}
            </dl>
            {t.bio && <p className="mt-4 whitespace-pre-line leading-8 text-slate-600">{t.bio}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/book?therapist=${t.id}`} className="btn-primary"><CalendarCheck className="h-4 w-4" />رزرو نوبت با {t.fullName.split(" ")[0]}</Link>
              {s["clinic.phone"] && <a href={`tel:${s["clinic.phone"]}`} className="btn-secondary"><Phone className="h-4 w-4" /><span className="num" dir="ltr">{toPersianDigits(s["clinic.phone"])}</span></a>}
            </div>
          </div>
        </div>
        {services.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-black text-brand-900">خدمات کلینیک</h2>
            <div className="mt-4 flex flex-wrap gap-2">{services.map((sv) => <Link key={sv.slug} href={`/services/${sv.slug}`} className="badge bg-white px-3 py-2 text-slate-700 shadow-soft hover:bg-brand-50">{sv.title}</Link>)}</div>
          </section>
        )}
        <section className="mt-10 text-sm text-slate-500">
          <p>{cleanName(s)} · {s["clinic.address"]} · {s["clinic.workingHours"]}</p>
        </section>
      </article>
      <PublicFooter settings={s} services={services} />
    </div>
  );
}

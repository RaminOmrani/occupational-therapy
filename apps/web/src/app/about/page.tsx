import type { Metadata } from "next";
import Link from "next/link";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { publicContext, pageMeta, JsonLd, breadcrumbJsonLd, cityOf, cleanName } from "@/lib/seo";
import { getClinic } from "@/lib/server";
import { Avatar } from "@/components/ui";
import { toPersianDigits } from "@toranj/shared";

export async function generateMetadata(): Promise<Metadata> {
  const { s } = await publicContext();
  return pageMeta(s, { title: `درباره ${cleanName(s)} | کلینیک کاردرمانی و توان‌بخشی ${cityOf(s)}`, description: (s["clinic.about"] || "").slice(0, 160), path: "/about", noTitleSuffix: true });
}

export default async function AboutPage() {
  const clinic = await getClinic();
  const s = clinic?.settings ?? {};
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} logo={s["clinic.logo"]} />
      <JsonLd data={breadcrumbJsonLd(s, [{ name: "درباره ما", path: "/about" }])} />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <nav aria-label="مسیر" className="mb-4 text-xs text-slate-400"><Link href="/" className="hover:text-brand-700">خانه</Link> › <span>درباره ما</span></nav>
        <h1 className="text-3xl font-black leading-[1.5] text-brand-900">درباره {s["clinic.name"]}؛ کلینیک کاردرمانی و توان‌بخشی در {cityOf(s)}</h1>
        <p className="mt-6 whitespace-pre-line text-base leading-9 text-slate-600">{s["clinic.about"]}</p>
        {!!clinic?.showcase?.length && (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {clinic.showcase.map((x) => <div key={x.key} className="card p-4 text-center"><div className="num text-3xl font-black text-brand-700">{toPersianDigits(x.value)}{x.suffix ?? "+"}</div><div className="mt-1 text-xs text-slate-500">{x.label}</div></div>)}
          </div>
        )}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[["ارزیابی دقیق", "سه پروفایل تخصصی جسمی، ادراکی-حرکتی و شناختی برای هر مراجع"], ["برنامه شخصی", "اهداف درمانی مشخص با پیگیری درصدی پیشرفت"], ["شفافیت کامل", "دسترسی خانواده به پرونده، برنامه و وضعیت مالی از طریق اپلیکیشن"]].map(([t, d]) => (
            <div key={t} className="card p-5"><h3 className="font-bold text-brand-800">{t}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{d}</p></div>
          ))}
        </div>
        {clinic?.therapists?.length ? (
          <>
            <h2 className="mt-14 text-2xl font-black text-brand-900">درمانگران ما <Link href="/team" className="mr-2 text-sm font-medium text-brand-700 hover:underline">صفحه تیم درمان</Link></h2>
            <div className="mt-6 space-y-4">
              {clinic.therapists.map((t) => (
                <div key={t.id} className="card flex gap-4 p-5">
                  <Avatar name={t.fullName} src={t.avatar} size="xl" />
                  <div><h3 className="text-lg font-bold"><Link href={`/team/${t.slug}`} className="hover:text-brand-700">{t.fullName}</Link></h3><p className="text-sm text-brand-700">{t.specialty}</p><p className="mt-2 leading-7 text-slate-500">{t.bio}</p></div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <PublicFooter settings={s} services={clinic?.services ?? []} />
    </div>
  );
}

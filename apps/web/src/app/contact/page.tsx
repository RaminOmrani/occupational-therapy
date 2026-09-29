import type { Metadata } from "next";
import Link from "next/link";
import { Phone, MapPin, Clock, AtSign } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { publicContext, pageMeta, JsonLd, breadcrumbJsonLd, cityOf, cleanName } from "@/lib/seo";
import { ContactForm } from "@/components/layout/ContactForm";
import { getClinic } from "@/lib/server";
import { toPersianDigits } from "@toranj/shared";

export async function generateMetadata(): Promise<Metadata> {
  const { s } = await publicContext();
  return pageMeta(s, { title: `تماس با کلینیک کاردرمانی ذهن سبز ${cityOf(s)} | آدرس، تلفن و رزرو`, description: `آدرس: ${s["clinic.address"] ?? ""} · تلفن: ${s["clinic.phone"] ?? ""} · ${s["clinic.workingHours"] ?? ""}. فرم تماس و رزرو ارزیابی ${cleanName(s)}.`, path: "/contact", noTitleSuffix: true });
}

export default async function ContactPage() {
  const clinic = await getClinic();
  const s = clinic?.settings ?? {};
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} logo={s["clinic.logo"]} />
      <JsonLd data={breadcrumbJsonLd(s, [{ name: "تماس با ما", path: "/contact" }])} />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <nav aria-label="مسیر" className="mb-4 text-xs text-slate-400"><Link href="/" className="hover:text-brand-700">خانه</Link> › <span>تماس با ما</span></nav>
        <h1 className="text-3xl font-black leading-[1.5] text-brand-900">تماس با ما و رزرو ارزیابی؛ کلینیک کاردرمانی ذهن سبز {cityOf(s)}</h1>
        <p className="mt-2 text-slate-500">فرم زیر را پر کنید تا همکاران ما با شما تماس بگیرند.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-5">
          <div className="card p-6 md:col-span-3"><ContactForm /></div>
          <div className="space-y-4 md:col-span-2">
            {[
              [Phone, "تلفن", toPersianDigits(s["clinic.phone"] ?? "")],
              [Phone, "موبایل / واتساپ", toPersianDigits(s["clinic.mobile"] ?? "")],
              [MapPin, "آدرس", s["clinic.address"]],
              [Clock, "ساعات کاری", s["clinic.workingHours"]],
              [AtSign, "اینستاگرام", s["clinic.instagram"]],
            ].filter(([, , v]) => v).map(([Icon, l, v]: any, i) => (
              <div key={i} className="card flex items-start gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon className="h-5 w-5" /></span>
                <div><p className="text-xs text-slate-400">{l}</p><p className="num font-medium">{v}</p></div>
              </div>
            ))}
            {s["clinic.mapUrl"] && <a href={s["clinic.mapUrl"]} target="_blank" className="btn-secondary w-full">مشاهده روی نقشه</a>}
          </div>
        </div>
      </div>
      <PublicFooter settings={s} services={clinic?.services ?? []} />
    </div>
  );
}
